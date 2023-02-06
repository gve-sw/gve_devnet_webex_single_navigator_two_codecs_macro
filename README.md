# GVE DevNet Webex single Navigator two Codecs macro

Macros to implement a meeting room two modes of operation using a Webex Codec Pro and a Webex Codec Plus device with a QuadCam connected to each and both codecs sharing one Navigator devic assisted by an Ethernet A/B switch controlled via GPIO pin.

The two modes of operation are:

### Standard Meeting Mode

The Codec Plus controls a single large display (as can be seen in this [Dual Orientation Camera Field of View](DualOrientationCameraFieldofView.pdf) diagram labeled as "Existing 80” Flat panel tv" on the North wall) on the short side of a rectancular room and is used for traditional meetings that are focused on participants seeing each other with the occasional sharing of content which will be displayed on the one large screen. In this mode, two screens on the wall on the long side of the room and QuadCam also on that side are not being used since the Codec Pro they are connected to remain in standby and Do Not Disturb modes. All calls are handled by the Codec Plus in this mode which has the Navigator connected to it.

### Presentation Mode

The Codec Pro which controls the two displays and QuadCam on the wall on the long side of the room are active and have the Navigator associated to it. The Codec Plus is on Half-Wake mode and has the ability to replicate any content being shared either locally or in a meeting by the Codec Pro on the large display on the wall on the short side of the room. This is achieved given a video tie-line between both codecs and the commands that the macros issue when detecting presentions on the Codec Pro. In this mode, the Codec Pro is in charge of joining any calls or meetings.

## Contacts

- Gerardo Chaves (gchaves@cisco.com)
- Enrico Conedera (econeder@cisco.com)

## Solution Components

- Webex Codec Pro
- Webex Codec Plus
- Webex Navigator
- Javascript
- xAPI
- Ethernet A/B switch controller (Extron)

## Installation/Configuration

The JavaScript based macros in this repository are designed to work with a Codec Pro and a Codec Plus device connected as specified in the included [Dual Orientation System Drawing](/DualOrientationSystemDrawing.pdf)

The included [Dual Orientation Camera Field of View](DualOrientationCameraFieldofView.pdf) drawing specifies the recommended layout of the room and location of the QuadCams, tables and displays for the room.

If you are unfamiliar with Cisco Room device macros, this is a good article to get started: https://help.webex.com/en-us/np8b6m6/Use-of-Macros-with-Room-and-Desk-Devices-and-Webex-Boards

1. Create local user accounts with at least Integrator roles on both codecs. Here are instructions on how to configure local user accounts on Webex Devices: https://help.webex.com/en-us/jkhs20/Local-User-Administration-on-Room-and-Desk-Devices  
   IMPORTANT: Both codecs must be on the same network so that they can communicate via HTTP without going through a firewall.

2. Install GMM_Lib.js and single_nav_pro.js on the Codec Pro. Make sure you keep the macro names the same as the file in which you received them: "GMM_Lib" and "single_nav_pro" correspondingly.

3. Install GMM_Lib.js and single_nav_plus.js on the Codec Plus. Make sure you keep the macro names the same as the file in which you received them: "GMM_Lib" and "single_nav_plus" correspondingly.

NOTE: If you change the name of the macros when installing them, they will not be able to correctly receive messages from the other codec.

4. On both codecs, edit the following constant to contain the IP address of the other codec for the solution:

```js
const SINGLE_NAV_CONFIG = {
  OTHER_CODEC_IP: "10.0.0.100",
};
```

5. The credentials that we pass onto the GMM library to be able to authenticate with the other codec to communicate with it are stored using Base64 encoding in the `Base64CodecPlusCredentials` constant. The default value on each macro is as follows:

```js
const Base64CodecPlusCredentials = "Q2FtZXJhTWFjcm86Q2FtZXJhTWFjcm8=";
```

That default value corresponds to username 'CameraMacro' and password 'CameraMacro' that are combined into one single string "CameraMacro:CameraMacro" and then encoded. To create your own to match the credentials for the local accounts you have created on each codec, you can use any Base64 encoding utility such as the one available at https://www.base64encode.org/

6. Edit the following string constants to match the terminology you prefer to use for the room and it´s modes of operation implemented by these macros:

```js
const strPresMode = "Presentation Mode";
const strStdMode = "Meeting Mode";
const strCustPanelName = "Mode Select";
```

The `strPresWelcomMsg` constant must be set differently on each room since it corresponds to the message displayed when a particular codec takes over for the mode it controls. For example on the Codec Pro you would set it to something like this:

```js
const strPresWelcomMsg =
  "Welcome to Presentation Mode. Please face the long wall";
```

Whereas on the Codec Plus it could be something like this:

```js
const strPresWelcomMsg =
  "Welcome to Meeting Mode. Please sit facing the 90 inch screen on the short wall";
```

7. Depending on how long it takes the ethernet switcher to connect the single Navigator in the room to one Codec or the other the following constants might need to be modified to reduce the chances of getting Touch Device detection errors or overlapping messages on the Navigator device:

```js
const welcomeDisplayDelay = 5000; //in milliseconds
const touchSetMinDelay = 2000; // in milliseconds
const activateStandbyDelay = 5000; // in milliseconds
```

The `touchSetMinDelay` constant in particular determines how to long to wait to change the number of Touch Devices the codec should be expecting (1 or 0) so, depending on if you are switching PoE sources or just using an injector for the Navigator between it and the switcher device, this time might need to vary.

8. On the Codec Pro, wire GPIO Pin 2 to the corresponding pin in the Ethernet A/B switch controller that will switch the Navigator Ethernet port to the Codec Pro (Presentation Mode).

9. Also on the Codec Pro, wire GPIO Pin 1 to the corresponding pin in the Ethernet A/B switch controller that will switch the Navigator Ethernet port to the Codec Plus (Standard Mode).

10. The Proactive Meeting Join feature interferes with this macro since it might prompt users to join a meeting on the screen of the inactive codec. The macro on both codecs will turn the feature on and off as needed, so you need to specify if you wish to enable that feature on the active codec according to the mode or leave it off by setting the `useProactiveMeetingJoin` constant to True or False on both macros:

```
const useProactiveMeetingJoin='True';
```

11. If you wish to use the USB Mode v3 macro for USB passthru , install the USB_Mode_Version_3.js macro onto the codec(s) you wish to use it with.

Here is a summary of each macro in this repository:

### GMM_Lib.js

This is a library shared by various Webex Device macros that simplifies communication between codecs and modules on the same codec.  
More details at: https://github.com/CiscoDevNet/roomdevices-macros-samples/tree/master/Global%20Macro%20Messaging

### USB_Mode_Version_3.js

This module is optional. It is a Beta version of the USB Mode V3 macro. Once the official version is published, you can use that version instead.

### single_nav_pro.js

This is the macro that runs on the Codec Pro and manages the GPIO Pins in addition to communicating with the Codec Plus when changing modes to configure itself correctly for either Presentation Mode (it is the active codec and will get the Navigator connected to it) or Standard Mode (it goes into DND and turns off ultrasound, but is still listening to the Codec Plus for commands to drive the GPIO pins)

### single_nav_plus.js

This is the macro that runs on the Codec Plus and manages the correct configurations on that codec for when being told by the Codec Pro which mode to be in it can execute the right commands, including also receiving a video signal from the Codec Pro when that one is presenting (in or out of a call) so it can be shown in the main display of the Codec Plus. It can also tell the Codec Pro to switch modes if a user on the Navigator selects the change while the Navigator is registered with the Codec Plus in "Standard Mode" .

## Usage

Once the macros are running and have done the initial configuration, you can switch room configurations from Standard Mode to Presentation Mode and vice-versa by selecting the appropirate room mode on the single Navigator in the room using the custom panel button. The user will also be informed of the current room mode when the codec comes out of the half-wake mode and will be prompted if they want to switch modes.

### LICENSE

Provided under Cisco Sample Code License, for details see [LICENSE](LICENSE.md)

### CODE_OF_CONDUCT

Our code of conduct is available [here](CODE_OF_CONDUCT.md)

### CONTRIBUTING

See our contributing guidelines [here](CONTRIBUTING.md)

#### DISCLAIMER:

<b>Please note:</b> This script is meant for demo purposes only. All tools/ scripts in this repo are released for use "AS IS" without any warranties of any kind, including, but not limited to their installation, use, or performance. Any use of these scripts and tools is at your own risk. There is no guarantee that they have been through thorough testing in a comparable environment and we are not responsible for any damage or data loss incurred with their use.
You are responsible for reviewing and testing any scripts you run thoroughly before use in any non-testing environment.
