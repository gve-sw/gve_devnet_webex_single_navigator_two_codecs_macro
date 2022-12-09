/*
Copyright (c) 2022 Cisco and/or its affiliates.
This software is licensed to you under the terms of the Cisco Sample
Code License, Version 1.1 (the "License"). You may obtain a copy of the
License at
               https://developer.cisco.com/docs/licenses
All use of the material herein must be in accordance with the terms of
the License. All rights not expressly granted by the License are
reserved. Unless required by applicable law or agreed to separately in
writing, software distributed under the License is distributed on an "AS
IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
or implied.
*/

const xapi = require('xapi');
import { GMM } from './GMM_Lib'

/*
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
+ This is the version for the Plus codec. This Codec is the one active in Standard mode, and receives
+ instructions from the codec Pro regarding presentation/start stop and change of mode, but it also
+ instructs the Codec Pro of any changes in mode while the Navigator is associated to this codec
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
*/



// For OTHER_CODEC_IP  enter the IP address Pro Codec.   
// The macro will prompt you for account credentials to connect to the Plus codec
// on the single Navigator device upon initial setup.
const SINGLE_NAV_CONFIG = {
  OTHER_CODEC_IP : '10.0.0.100'
}

const Base64CodecPlusCredentials='Q2FtZXJhTWFjcm86Q2FtZXJhTWFjcm8='


const strPresMode='Townhall Mode'
const strStdMode='Meeting Mode'
const strCustPanelName='Mode Select'
const strPresWelcomMsg='Welcome to Meeting Mode. Please sit facing the 90 inch screen on the North wall'

const welcomeDisplayDelay=5000; //in milliseconds
const touchSetMinDelay=2000; // milliseconds

/*
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
+ DO NOT EDIT ANYTHING BELOW THIS LINE                                  +
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
*/



const PANEL_panel_change_mode=`<Extensions><Version>1.9</Version>
  <Panel>
    <Order>5</Order>
    <PanelId>panel_change_mode</PanelId>
    <Origin>local</Origin>
    <Location>HomeScreen</Location>
    <Icon>Sliders</Icon>
    <Color>#00D6A2</Color>
    <Name>${strCustPanelName}</Name>
    <ActivityType>Custom</ActivityType>
    <Page>
      <Name>${strCustPanelName}</Name>
      <Row>
        <Name>Row</Name>
        <Widget>
          <WidgetId>widget_select_mode</WidgetId>
          <Type>GroupButton</Type>
          <Options>size=4</Options>
          <ValueSpace>
            <Value>
              <Key>1</Key>
              <Name>${strPresMode}</Name>
            </Value>
            <Value>
              <Key>2</Key>
              <Name>${strStdMode}</Name>
            </Value>
          </ValueSpace>
        </Widget>
      </Row>
      <Options>hideRowNames=1</Options>
    </Page>
  </Panel>
</Extensions>
`


//Declare your object for GMM communication
var proCodec;

var stbyTriggeredHere=false;


//Run your init script asynchronously 
async function init_intercodec() {
  try {
    //proCodec = new GMM.Connect.IP(await GMM.ReadAuth('proCodec', 'IP'), '', SINGLE_NAV_CONFIG.OTHER_CODEC_IP)
    proCodec = new GMM.Connect.IP(Base64CodecPlusCredentials, '', SINGLE_NAV_CONFIG.OTHER_CODEC_IP)
  } catch (e) {
    console.error(e)
    //proCodec = new GMM.Connect.IP(await GMM.CaptureAuth('proCodec', 'IP'), '', SINGLE_NAV_CONFIG.OTHER_CODEC_IP)
  }
  // console.log(proCodec) 
}


/////////////////////////////////////////////////////////////////////////////////////////
// VARIABLES
/////////////////////////////////////////////////////////////////////////////////////////


// presentationMode keeps the current state for the codec. It is normally also reflected in 
// permanent storage (GMMMemory macro) in the SingleNav_presentationModeState global
var presentationMode = false;


function storeSingleNavModeState(presentationModeValue) {
  presentationMode = presentationModeValue;
  GMM.write.global('SingleNav_presentationModeState',presentationMode).then(() => {
    console.log({ Message: 'ChangeMode', Action: 'Presentation mode state stored.' })
  })

}



/**
  * This will initialize the room state to Presentation of Standard mode based on the setting in Memory Macro (persistent storage)
**/
function initialSingleNavModeState() {
if (presentationMode) {
  console.log('In presentation mode....');
  // set this codec to not expect any Navigator devices while in Presentation mode
  setTimeout(function(){xapi.Config.Peripherals.Profile.TouchPanels.set('0');}, touchSetMinDelay);
  plusPresentationMode();
  storeSingleNavModeState(true);
} else {
  console.log('In standard mode...');
  //Set min navigator devices to 1
  setTimeout(function(){xapi.Config.Peripherals.Profile.TouchPanels.set('Minimum1');}, touchSetMinDelay);
  plusStandardMode();
  storeSingleNavModeState(false);
}
}


/////////////////////////////////////////////////////////////////////////////////////////
// ERROR HANDLING
/////////////////////////////////////////////////////////////////////////////////////////

function handleError(error) {
  console.log(error);
}

function handleMissingWigetError(error) {
  console.log('Trying to set widget that is not being shown...');
}

/////////////////////////////////////////////////////////////////////////////////////////
// INTER-MACRO MESSAGE HANDLING
/////////////////////////////////////////////////////////////////////////////////////////
GMM.Event.Receiver.on(event => {
  if (event.Source.Id!='localhost') 
        { // This section is for handling messages sent from primary to secondary codec and vice versa
              switch (event.App) { //Based on the App (Macro Name), I'll run some code
              case 'single_nav_pro':
                if (event.Type == 'Error') {
                  console.error(event)
                } else {
                  switch (event.Value) {
                    case 'SWITCH_TO_PRESENTATION':
                      switchToPresentationMode(false);
                      //Update the custom panel toggle switch
                      evalCustomPanels();
                    break;
                    case 'SWITCH_TO_STANDARD':
                      switchToStandardMode(false);
                      //Update the custom panel toggle switch
                      evalCustomPanels();
                    break;
                    case 'STARTED_PRESENTING':
                      handleProStartPresenting();
                    break;
                    case 'STOPPED_PRESENTING':
                      handleProStopPresenting();
                    break;
                    default:
                    break;
                  }
                }
                break;

              default:
                console.debug({
                  Message: `Received Message from ${event.App} and was not processed`
                })
                break;
            }

        }

      })

/////////////////////////////////////////////////////////////////////////////////////////
// INTER-CODEC COMMUNICATION
/////////////////////////////////////////////////////////////////////////////////////////


function sendIntercodecMessage(message) { 
  if (proCodec!='') proCodec.status(message).post().catch(e=>{
    console.log('Error sending message');
    alertFailedIntercodecComm("Error connecting to Codec Pro, please contact the Administrator");
  });
}

function alertFailedIntercodecComm(message) {
  xapi.command("UserInterface Message Alert Display", {
  Text: message
, Duration: 10
}).catch((error) => { console.error(error); });
}



function evalCustomPanels() {
  // then create the toggle based custom panel
  xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'panel_change_mode' },
    PANEL_panel_change_mode);
  if (presentationMode) {
    xapi.command('UserInterface Extensions Widget SetValue', {WidgetId: 'widget_select_mode', Value: '1'});
  }
  else
  {
    xapi.command('UserInterface Extensions Widget SetValue', {WidgetId: 'widget_select_mode' , Value: '2'});
  }

}

/////////////////////////////////////////////////////////////////////////////////////////
// INITIALIZATION
/////////////////////////////////////////////////////////////////////////////////////////


async function init()
{
  console.log('init');
  await GMM.memoryInit();
  await GMM.write.global('SINGLE_NAV_CONFIG', SINGLE_NAV_CONFIG).then(() => {
      console.log({ Message: 'Init', Action: 'Single Navigator config stored.' })
    });
  await init_intercodec(); 


  presentationMode=await GMM.read.global('SingleNav_presentationModeState').catch(async e=>{
    //console.error(e);
    console.log("No initial SingleNav_presentationModeState global detected, creating one...")
    await GMM.write.global('SingleNav_presentationModeState',false).then(() => {
      console.log({ Message: 'Init', Action: 'Single Nav mode stored.' })
    })
    return false;
  })

  // Add CUSTOM PANEL
  evalCustomPanels();

  // proStandardMode() is called within initialSingleNavModeState() if appropriate
  initialSingleNavModeState();
  listenToStandby();
  await registerTouchPanelStatusHandler();
}





/////////////////////////////////////////////////////////////////////////////////////////
// TOUCH 10 UI FUNCTION HANDLERS
/////////////////////////////////////////////////////////////////////////////////////////


async function handleWidgetActions(event)
{
    switch (event.WidgetId) {
      case 'widget_select_mode':
        console.log("Single Nav Presentation Mode " + event.WidgetId + ' set to ' + event.Value);
        if(event.Value === '1')
        {
          switchToPresentationMode(true);
        }
        else if(event.Value === '2')
        {
          switchToStandardMode(true);
        }
    break;
  }

}

xapi.event.on('UserInterface Extensions Widget Action', (event) => handleWidgetActions(event));



function listenToStandby() {
  xapi.Status.Standby.State.on(state => {
    console.log("Standby State: " + state);
    if(!presentationMode){
        if(state === 'Standby') {
          console.log('Going into standby mode...')
        }
        else if (state === 'Off' && !stbyTriggeredHere) {
          console.log('Exiting standby mode...')
          // Prompt if they want to switch modes
          let strCurrentModeName=(presentationMode)?strPresMode:strStdMode;
          let strOtherModeName=(presentationMode)?strStdMode:strPresMode;
          xapi.command("UserInterface Message Prompt Display", {
            Title: 'Room Mode',
            Text: 'The system is in '+strCurrentModeName+' currently',
            FeedbackId: 'displayConfirmModePrompt',
            'Option.1':'Remain in this mode',
            'Option.2':'Change to '+strOtherModeName
          }).catch((error) => { console.error(error); });
        } else if (stbyTriggeredHere) stbyTriggeredHere=false;
    }
  });
}



/////////////////////////////////////////////////////////////////////////////////////////
// SWITCH BETWEEN Presentation AND Standard Modes
/////////////////////////////////////////////////////////////////////////////////////////


async function plusPresentationMode() {
  xapi.config.set('Standby Halfwake Mode', 'Manual').catch((error) => {
    console.log('Your software version does not support this configuration.  Please install ‘Custom Wallpaper’ on the codec in order to prevent Halfwake mode from occurring.');
    console.error(error);
  });
  // route HDMI input 2 to the display (using the video matrix).
  xapi.Command.Video.Matrix.Reset();
  xapi.Command.Video.Matrix.Assign({ Output: 1,  SourceId: 2 }); 
  // Turn off ultrasound
  await xapi.Config.Audio.Ultrasound.MaxVolume.set(0);
  // turn on DND
  xapi.Command.Conference.DoNotDisturb.Activate();
  // Set Halfwake here on the Plus Codec since when first going to Presentation mode the Pro is not yet presenting. 
  xapi.Command.Standby.Halfwake();
}

async function plusStandardMode() {
  // Turn ultrasound volume up to 70
  await xapi.Config.Audio.Ultrasound.MaxVolume.set(70);
  // Turn off DND
  xapi.Command.Conference.DoNotDisturb.Deactivate();
  // reset video matrix
  xapi.Command.Video.Matrix.Reset();
  // wake up codec
  stbyTriggeredHere=true;
  xapi.Command.Standby.Deactivate();

}

function handleProStartPresenting(){ // this is all within Presentation mode
 // route HDMI input 2 to the display (using the video matrix).
 xapi.Command.Video.Matrix.Reset();
 xapi.Command.Video.Matrix.Assign({ Output: 1,  SourceId: 2 }); 
 // exit halfwake mode
 xapi.Command.Standby.Deactivate();
}

function handleProStopPresenting(){ // this is all within Presentation mode
 //go to Halfwake mode, so the screen is blank.
 xapi.Command.Standby.Halfwake();
}


/////////////////////////////////////////////////////////////////////////////////////////
// OTHER FUNCTIONAL HANDLERS
/////////////////////////////////////////////////////////////////////////////////////////

//Run DoNoDisturb Every 24 hours at 1am local time
GMM.Event.Schedule.on('01:00', event => {
  console.log(event);
  console.log('Setting DND on daily schedule...')
  if (presentationMode) {
    xapi.Command.Conference.DoNotDisturb.Activate({ Timeout: 1440 });
  }
})


function switchToPresentationMode(sendNotification) {
  console.log('Switch to presentation mode....');
  // set this codec to not expect any Navigator devices while in Presentation mode
  setTimeout(function(){xapi.Config.Peripherals.Profile.TouchPanels.set('0');}, touchSetMinDelay);
  presentationMode=true;
  plusPresentationMode();
  storeSingleNavModeState(true);
  if (sendNotification) {
            //Tell the Plus codec that it should switch modes
            sendIntercodecMessage('SWITCH_TO_PRESENTATION');
  }
  // set this codec to not expect any Navigator devices while in Presentation mode
  setTimeout(function(){xapi.Config.Peripherals.Profile.TouchPanels.set('0');}, touchSetMinDelay);

}

function switchToStandardMode(sendNotification) {
  console.log('Switch to standard mode...');
  presentationMode=false;
  plusStandardMode();
  storeSingleNavModeState(false);
  if (sendNotification) {
    //Tell the Plus codec that it should switch modes
    sendIntercodecMessage('SWITCH_TO_STANDARD');
  }
}

xapi.event.on('UserInterface Message Prompt Response', (event) =>
{
  switch(event.FeedbackId){
    case 'displayConfirmModePrompt':
      if (event.OptionId=='2') {
        console.log('Requested to swap modes...')
        if (presentationMode)
        {
          switchToStandardMode(true);
        }
        else
        {
          switchToPresentationMode(true);
        }
        //Update the custom panel toggle switch
        evalCustomPanels();
      }

    break;
  }
});

function displayWelcome()
{
  xapi.command('UserInterface Message Prompt Display', {
        Title: 'Welcome',
        Text: strPresWelcomMsg,
        FeedbackId: 'displayWelcome',
        'Option.1':'Dismiss'
      }).catch((error) => { console.error(error); });

}

async function registerTouchPanelStatusHandler() {
  let value = await xapi.Command.Peripherals.List({ Type: 'TouchPanel' })
  console.log(value)
  let theTPID=0;
  if (value.Device.length>0){
    //assuming just one TouchPanel
    theTPID=parseInt(value.Device[0].id);
    console.log('TouchPanel ID: ',theTPID)
    xapi.Status.Peripherals.ConnectedDevice[theTPID].Status
      .on(value => {
        console.log('Peripheral Device Status: ',value);
        if (value=='Connected') {
              //Here with a 5 second delay put up a welcome message
              setTimeout(function(){displayWelcome()}, welcomeDisplayDelay);
              //Set min navigator devices to 1
              setTimeout(function(){xapi.Config.Peripherals.Profile.TouchPanels.set('Minimum1');}, touchSetMinDelay);
        }
        });
  }
  else
  {
    console.log("No TouchPanels detected...")
    //TODO: make sure if no TouchPanels are detected, we try to detect them at regular intervals later.
  }
}

/////////////////////////////////////////////////////////////////////////////////////////
// INVOCATION OF INIT() TO START THE MACRO
/////////////////////////////////////////////////////////////////////////////////////////

init();
