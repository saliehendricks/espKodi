# espKodi
With an ESP + IR Receiver, you can use any remote control to broadcast commands to an MQTT Server
I use this to control Kodi running on my desktop windows server. HDMI CEC does not work for me.

ESP8266 Code:
Included is code for the ESP32 / ESP8266 01-12 (tested it on a Lolin board). It is a simple program to receive IR commands and broadast the result to an MQTT server.
You can modify this code to perform an http call to Kodi directly but I found this to be very slow. Instead the MQTT server is generally more capable and thus faster to execute HTTP calls/responses

You can use the IR remote to perform whatever action you need, this code simply broadcasts to a local MQTT server.

IR codes are for SAMSUNG. You will need to update the codes for your remotes. If anyone wants to dump their codes in I can add them here


A picture:

![alt architecture-pic](https://raw.githubusercontent.com/saliehendricks/espKodi/master/io-architecture.png)

NodeJS/Raspberry Pi code:
The MQTT Server can be independent from the NodeJs web server. To simplify things you can just run teh App.js code, since its setup to run mongo, express and mqtt server.

The server includes code to receive an http rest request like /[nodeid]/[pin]/0|1 and it will broadcast that message to the correct ESP8266 which will receive the command and execute the IO. These ESP8266's run aRest (https://github.com/marcoschwartz/aREST) with a modified MQTT server rather than the aRest Service. aRest is a great library and service - go check it out. Marco has done some excellent work on making this easy to setup (free and paid version).

