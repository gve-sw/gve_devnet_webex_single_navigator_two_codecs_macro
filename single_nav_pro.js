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
+ This is the version for the Pro codec. This Codec is the one active in Presentation mode, but
+ it also controls all GPIO communications with Ethernet switcher so it needs to be actively 
+ monitoring and keeping track of ovarall room state. 
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
*/



// For OTHER_CODEC_IP  enter the IP address Plus Codec.   
// The macro will prompt you for account credentials to connect to the Pro codec
// on the single Navigator device upon initial setup.
const SINGLE_NAV_CONFIG = {
  OTHER_CODEC_IP : '10.0.0.100'
}

const Base64CodecPlusCredentials='Q2FtZXJhTWFjcm86Q2FtZXJhTWFjcm8='

const strPresMode='Townhall Mode'
const strStdMode='Meeting Mode'
const strCustPanelName='Mode Select'
const strPresWelcomMsg='Welcome to Townhall Mode. Please face the West wall'

const welcomeDisplayDelay=5000; //in milliseconds
const touchSetMinDelay=2000; // in milliseconds
const activateStandbyDelay=5000; // in milliseconds

const useProactiveMeetingJoin='True'; 


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
var plusCodec;

var stbyTriggeredHere=false;

var proInCall=false;
var plusInCall=false;

//Run your init script asynchronously 
async function init_intercodec() {
  try {
    //plusCodec = new GMM.Connect.IP(await GMM.ReadAuth('plusCodec', 'IP'), '', SINGLE_NAV_CONFIG.OTHER_CODEC_IP)
    plusCodec = new GMM.Connect.IP(Base64CodecPlusCredentials, '', SINGLE_NAV_CONFIG.OTHER_CODEC_IP)
  } catch (e) {
    console.error(e)
    //plusCodec = new GMM.Connect.IP(await GMM.CaptureAuth('plusCodec', 'IP'), '', SINGLE_NAV_CONFIG.OTHER_CODEC_IP)
  }
  // console.log(plusCodec) 
}


/////////////////////////////////////////////////////////////////////////////////////////
// VARIABLES
/////////////////////////////////////////////////////////////////////////////////////////



// presentationMode keeps the current state of the codec. It is normally also reflected in 
// permanent storage (GMMMemory macro) in the SingleNav_presentationModeState global.  
var presentationMode = false;


/**
  * The following functions allow the ability to set the Pins High or Low
**/

// Pin 2 is used to trigger Presentation mode
function setGPIOPin2ToHigh() {
  xapi.command('GPIO ManualState Set', {Pin2: 'High'}).catch(e=>console.debug(e));
  console.log('Pin 2 has been set to High');
}

function setGPIOPin2ToLow() {
  xapi.command('GPIO ManualState Set', {Pin2: 'Low'}).catch(e=>console.debug(e));
  console.log('Pin 2 has been set to Low');
}

// Pin 1 is used to trigger Presentation mode
function setGPIOPin1ToHigh() {
  xapi.command('GPIO ManualState Set', {Pin1: 'High'}).catch(e=>console.debug(e));
  console.log('Pin 1 has been set to High');
}

function setGPIOPin1ToLow() {
  xapi.command('GPIO ManualState Set', {Pin1: 'Low'}).catch(e=>console.debug(e));
  console.log('Pin 1 has been set to Low');
}

function switchToPresentationGPIO()
{
  setGPIOPin2ToHigh()
  // wait 200ms before setting back to low
  setTimeout(setGPIOPin2ToLow, 200);
  
}

function switchToStandardGPIO()
{
  setGPIOPin1ToHigh()
  // wait 200ms before setting back to low
  setTimeout(setGPIOPin1ToLow, 200);
}

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
        //Set min navigator devices to 1
        setTimeout(function(){xapi.Config.Peripherals.Profile.TouchPanels.set('Minimum1');}, touchSetMinDelay);
        proPresentationMode();
        switchToPresentationGPIO();
        storeSingleNavModeState(true);
      } else {
        console.log('In standard mode...');
        // set this codec to not expect any Navigator devices while in Standard mode
        setTimeout(function(){xapi.Config.Peripherals.Profile.TouchPanels.set('0');}, touchSetMinDelay);
        proStandardMode();
        switchToStandardGPIO();
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
              case 'single_nav_plus':
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
                    case 'CALL_CONNECTED':
                      plusInCall=true;
                      evalCustomPanels();
                    break;
                    case 'CALL_DISCONNECTED':
                      plusInCall=false;
                      evalCustomPanels();
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
  if (plusCodec!='') plusCodec.status(message).queue().catch(e=>{
    console.log('Error sending message');
    alertFailedIntercodecComm("Error connecting to Codec Plus, please contact the Administrator");
  });
}

GMM.Event.Queue.on(report => {
  //The queue will continuously log a report to the console, even when it's empty.
  //To avoid additional messages, we can filter the Queues Remaining Requests and avoid it if it's equal to Empty
  if (report.QueueStatus.RemainingRequests != 'Empty') {
    report.Response.Headers = [] // Clearing Header response for the simplicity of the demo, you may need this info
    //console.log(report)
  }
});

function alertFailedIntercodecComm(message) {
  xapi.command("UserInterface Message Alert Display", {
  Text: message
, Duration: 10
}).catch((error) => { console.error(error); });
}


function evalCustomPanels() {
    // then create the toggle based custom panel
    if (proInCall || plusInCall) {
      xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'panel_change_mode' });
    }
    else {
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
}


// register handler for Call Successful
xapi.Event.CallSuccessful.on(async () => {
  console.log("call connected...");
  // always tell the other codec when your are in or out of a call
  sendIntercodecMessage('CALL_CONNECTED');
  proInCall=true;
  evalCustomPanels();
});

// register handler for Call Disconnect
xapi.Event.CallDisconnect.on(async () => {
  // always tell the other codec when your are in or out of a call
  sendIntercodecMessage('CALL_DISCONNECTED');
  proInCall=false;
  evalCustomPanels();
});

// register WebRTC Mode call tracker
xapi.Status.UserInterface.WebView.Type
.on(async(value) => {
  if (value==='WebRTCMeeting') {
    // always tell the other codec when your are in or out of a call
    sendIntercodecMessage('CALL_CONNECTED');
    proInCall=true;
    evalCustomPanels();
  } else {
    // always tell the other codec when your are in or out of a call
    sendIntercodecMessage('CALL_DISCONNECTED');
    proInCall=false;
    evalCustomPanels();
  }
});





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

  // GPIO
  xapi.config.set('GPIO Pin 2 Mode', 'OutputManualState')
    .catch((error) => { console.error("34"+error); });
  xapi.config.set('GPIO Pin 1 Mode', 'OutputManualState')
    .catch((error) => { console.error("35"+error); });
      
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
    if(presentationMode){
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
    } else xapi.Command.Standby.Activate(); // TODO: Remove this else statement if never gets out of standby
  });
}



/////////////////////////////////////////////////////////////////////////////////////////
// SWITCH BETWEEN Presentation AND Standard Modes
/////////////////////////////////////////////////////////////////////////////////////////

async function proPresentationMode()  
{
  xapi.command('Video Matrix Reset').catch((error) => { console.error(error); }); 
  // Turn ultrasound volume up to 70
  await xapi.Config.Audio.Ultrasound.MaxVolume.set(70);
  // Turn off DND
  xapi.Command.Conference.DoNotDisturb.Deactivate();
  // wake up codec
  stbyTriggeredHere=true;
  xapi.Command.Standby.Deactivate();
  // manager proactive join mode
  if (useProactiveMeetingJoin) xapi.Config.UserInterface.Assistant.ProactiveMeetingJoin.set('True');

 }

 async function proStandardMode()  
 {
  console.log("Setting up Standard Mode in Codec Pro");
  // Turn ultrasound volume down to 0
  await xapi.Config.Audio.Ultrasound.MaxVolume.set(0);

  // manage proactive join mode
  xapi.Config.UserInterface.Assistant.ProactiveMeetingJoin.set('False');
  // Set DND
  xapi.Command.Conference.DoNotDisturb.Activate();
  // wake up codec with a delay to give chance to clear out any missing Navigator warnings
  setTimeout(function(){xapi.Command.Standby.Activate();}, activateStandbyDelay);

}

/////////////////////////////////////////////////////////////////////////////////////////
// OTHER FUNCTIONAL HANDLERS
/////////////////////////////////////////////////////////////////////////////////////////

//Run DoNoDisturb Every 24 hours at 1am local time
GMM.Event.Schedule.on('01:00', event => {
  console.log(event);
  console.log('Setting DND on daily schedule...')
  if (!presentationMode) {
    xapi.Command.Conference.DoNotDisturb.Activate({ Timeout: 1440 });
  }
})

xapi.Event.PresentationStarted.on(value => {
  console.log(value)
  if (presentationMode) {
    sendIntercodecMessage('STARTED_PRESENTING');
  }
});


xapi.Event.PresentationPreviewStarted.on(value => {
  console.log(value)
  if (presentationMode) {
    sendIntercodecMessage('STARTED_PRESENTING');
  }
});


xapi.Event.PresentationStopped.on(value => {
  console.log(value);
  if (presentationMode) {
    sendIntercodecMessage('STOPPED_PRESENTING');
  }
});

xapi.Event.PresentationPreviewStopped.on(value => {
  console.log(value);
  if (presentationMode) {
    sendIntercodecMessage('STOPPED_PRESENTING');
  }
});


function switchToPresentationMode(sendNotification) {
  console.log('Switch to presentation mode....');
  presentationMode=true;
  proPresentationMode();
  switchToPresentationGPIO();
  storeSingleNavModeState(true);
  if (sendNotification) {
            //Tell the Plus codec that it should switch modes
            sendIntercodecMessage('SWITCH_TO_PRESENTATION');
  }

}

function switchToStandardMode(sendNotification) {
  console.log('Switch to standard mode...');
  xapi.Command.Presentation.Stop();
    // set this codec to not expect any Navigator devices while in Standard mode
  setTimeout(function(){xapi.Config.Peripherals.Profile.TouchPanels.set('0');}, touchSetMinDelay);
  presentationMode=false;
  proStandardMode();
  switchToStandardGPIO();
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
