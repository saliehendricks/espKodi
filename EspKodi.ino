
// This code is for the ESP32 / ESP8266 01-12 (tested it on a Lolin board)
// Simple program to receive IR commands and broadast the result to an MQTT server.
// You can modify to do an http call to Kodi directly but I found this to be very slow. 
// Instead the MQTT server is generally more capable and thus faster to execute HTTP calls/responses

// You can use the IR remote to perform whatever action you need, i need it to control KODI as HDMI-CEC is slow & unrealiable and
// when KODI is running on a desktop server like mine, NVIDIA GPU's do not support CEC

// IR codes below are for SAMSUNG. You will need to update the codes for your remotes. Feel free to create pull requests
// and I can include them in this for more people.


#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>
#include <EEPROM.h>
#include <WiFiManager.h>          //https://github.com/tzapu/WiFiManager
#include <WifiRestClient.h>
#include <IRremoteESP8266.h>
#include <PubSubClient.h>    
#include <WiFiClient.h>  

// An IR detector/demodulator is connected to GPIO pin 14(D5 on a NodeMCU board).
int RECV_PIN = 14;
IRrecv irrecv(RECV_PIN);

const int UP = 0;
const int DOWN = 1;
const int LEFT = 2;
const int RIGHT = 3;
const int SELECT = 4;
const int BACK = 5;
const int EXIT = 6;
const int PLAY = 7;
const int PAUSE = 8;
const int STOP = 9;

String C_UP     = ",E0E006F9,C03F6897";
String C_DOWN   = ",E0E08679,C03FE817";
String C_LEFT   = ",E0E0A659,C03F58A7";
String C_RIGHT  = ",E0E046B9,C03FC837";
String C_SELECT = ",E0E016E9,C03F28D7";
String C_BACK   = ",E0E01AE5,E0E0B44B,C03F9867";
String C_PLAY   = ",E0E0E21D";
String C_PAUSE  = ",E0E052AD";
String C_STOP  =  ",E0E0629D";

bool isBroadCast = true;
bool isDirectHttp = false;
String baseUrl = "192.168.10.20";
int kodiPort= 8081;

//MQTT
WiFiClient espClient;
PubSubClient client(espClient);
const char* mqtt_server = "192.168.10.36";

int debounceMs = 250;
void setup() {
  Serial.begin(115200, SERIAL_8N1, SERIAL_TX_ONLY);  // Status message will be sent to the PC at 115200 baud
  Serial.print("Starting..");
  irrecv.enableIRIn();  // Start the receiver
  Serial.print("Gogo");

  const char* ssid = "ssid"; //TODO add your wifi details here
  const char* password = "****"; //password here

  //Wifi setup
  WiFiManager wifi;
  wifi.autoConnect();
  Serial.println("Connected to wifi ok)");

  //wifiServer.begin();
  //Serial.println("Web Server started");
  Serial.print("Chip ID: ");
  Serial.println(String(ESP.getChipId(), HEX));
  
  //pubsub client
  client.setServer(mqtt_server, 1883);
  Serial.print("MQTT Connected");
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect("ESP8266Client_Kodi")) {
      Serial.println("connected");
      // Once connected, publish an announcement...
      client.publish("kodicom", "hello kodi");      
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}
  
void loop() {

  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  decode_results  results;
  String lastSentCode = "";
  if (irrecv.decode(&results)) {
    int receievedMs = millis();
    
    String code = String(results.value,HEX);
    
    code.toUpperCase();
    //Serial.println(results.value, HEX);
    Serial.println(code);
    Serial.println("");
    irrecv.resume();              // Prepare for the next value

    //received command
    //broadcast it or call direct
    
    String actionUrl = "";
    String body = "";

    if(C_UP.indexOf(code) > 0)
    {
      actionUrl = "jsonrpc?Input.Up";
      body = "{\"jsonrpc\":\"2.0\",\"method\":\"Input.Up\",\"id\":1}";       
    }
    else if(C_LEFT.indexOf(code) > 0)
    {
      actionUrl = "jsonrpc?Input.Left";
      body = "{\"jsonrpc\":\"2.0\",\"method\":\"Input.Left\",\"id\":1}";       
    }
    else if(C_DOWN.indexOf(code) > 0)
    {
      actionUrl = "jsonrpc?Input.Down";
      body = "{\"jsonrpc\":\"2.0\",\"method\":\"Input.Down\",\"id\":1}";       
    }
    else if(C_RIGHT.indexOf(code) > 0)
    {
      actionUrl = "jsonrpc?Input.Right";
      body = "{\"jsonrpc\":\"2.0\",\"method\":\"Input.Right\",\"id\":1}";       
    }
    else if(C_SELECT.indexOf(code) > 0)
    {
      actionUrl = "jsonrpc?Input.Select";
      body = "{\"jsonrpc\":\"2.0\",\"method\":\"Input.Select\",\"id\":1}";       
    }
    else if(C_BACK.indexOf(code) > 0)
    {
      actionUrl = "jsonrpc?Input.Back";
      body = "{\"jsonrpc\":\"2.0\",\"method\":\"Input.Back\",\"id\":1}";       
    }
    else if(C_PLAY.indexOf(code) > 0)
    {
      actionUrl = "jsonrpc?Player.PlayPause";
      body = "{\"jsonrpc\":\"2.0\",\"method\":\"Player.PlayPause\",\"id\":1, \"params\" : {\"playerid\" : 1}}";       
    }
    else if(C_PAUSE.indexOf(code) > 0)
    {
      actionUrl = "jsonrpc?Player.PlayPause";
      body = "{\"jsonrpc\":\"2.0\",\"method\":\"Player.PlayPause\",\"id\":1, \"params\" : {\"playerid\" : 1}}";       
    }
    else if(C_STOP.indexOf(code) > 0)
    {
      actionUrl = "jsonrpc?Player.Stop";
      body = "{\"jsonrpc\":\"2.0\",\"method\":\"Player.Stop\",\"id\":1, \"params\" : {\"playerid\":1}}";       
    }
    Serial.println(actionUrl);
    
    if(isBroadCast && actionUrl != "")
    {
      if(lastSentCode == code && (millis() -receievedMs < debounceMs))
      {
        //skip this send
      }
      else{
        Serial.print("publishing...");
        client.publish("kodicom", actionUrl.c_str());
        Serial.println("mqtt published");
        lastSentCode = code;
      }
      
    }    
    if(isDirectHttp)
    {
      if(actionUrl != "" )
      {
        WiFiRestClient restClient(baseUrl.c_str(),kodiPort);
      
        int statusCode = restClient.post(actionUrl.c_str(),body.c_str());
        //int statusCode = restClient.get(restcall.c_str(), &response);
        Serial.print("response http code: "); 
        //Serial.print(response);
        Serial.println(statusCode);
      }
      
        
    }

   
  }
}
