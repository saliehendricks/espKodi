# espKodi
With an ESP + IR Receiver, you can use any remote control to broadcast commands to an MQTT Server
I use this to control Kodi running on my desktop windows server. HDMI CEC does not work for me.


This code is for the ESP32 / ESP8266 01-12 (tested it on a Lolin board)
Simple program to receive IR commands and broadast the result to an MQTT server.
You can modify to do an http call to Kodi directly but I found this to be very slow. 
Instead the MQTT server is generally more capable and thus faster to execute HTTP calls/responses

You can use the IR remote to perform whatever action you need, this code simply broadcasts to a local MQTT server.

IR codes are for SAMSUNG. You will need to update the codes for your remotes. If anyone wants to dump their codes in I can add them here


A picture:

![alt architecture-pic](https://raw.githubusercontent.com/saliehendricks/espKodi/master/io-architecture.png)
