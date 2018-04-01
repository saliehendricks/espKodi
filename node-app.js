
/**
 * This is a snippet of NodeJS code that fires up an MQTT server and a little mongoDb. 
 * This server acts as a central node for ESP8266/32 that are littered around my house. They each have an input and output channel.
 * 
 * The purpose of this server is two fold. Firstly it is capable of receiving HTTP REST calls and will send these commands to a sepcific ESP8266/32s eg:
 * http://thisserverip/nodeid/pin/value (0 or 1)
 * 
 * The nodes run the aREST library. see arest.io if you want all this live and want support. Great library and has free and paid configurations.
 * 
 * The second feature added was the ability to receive commands from a Node channel and execute an HTTP command. I found ESPs to be a bit slow for some 
 * applications.
 * 
 * Forgive me - I am neither a Node or C developer :D
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var wol = require('node-wol'); //wake on lan
var mongoose = require('mongoose');
var request = require('request');
var http = require('http');

mongoose.connect('mongodb://localhost/nurio');

var NodeModel = mongoose.model('Node', { Id: String, inTopic: String, outTopic: String, IpAddress: String, chipId: String });
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  // we're connected!
    console.log('Connected to mongodb server...');
});

loadNodes();

var mqtt = require('mqtt');
var mqttserver = 'mqtt://localhost:1883';
var client = mqtt.connect(mqttserver);

//var cec = new nodecec();
var app = express();
var noderes = [];
var nodes = [];

//kodi
var kodiServer = "192.168.10.20";
var kodiPort = 8081;

// a failed execution of CEC on the PI. I leave my mistakes for all to see :D
// start cec connection
//cec.start();
// cec.on('ready', function(data) {
    // console.log("cec ready...");
// });

// cec.on('status', function(data) {
   // console.log("[" + data.id + "] changed from " + data.from + " to " + data.to); 
// });

// cec.on('key', function(data) {
    // console.log(data.name);
// });

// cec.on('close', function(code) {
    // process.exit(0);
// });

// cec.on('error', function(data) {
    // console.log('---------------- ERROR ------------------');
    // console.log(data);
    // console.log('-----------------------------------------');
// });

function loadNodes() {

var cursor = NodeModel.find().exec(function(err, nodelist) {
	console.log('Loaded node count: ' + nodelist.length);
	for(var i = 0; i< nodelist.length; i++)
	{
		var n = nodelist[i];
		console.log(JSON.stringify(n));
		nodes[n.Id] = n;    
	}
	
});
// cursor.on('data', function(n) {
	// nodes[n.Id] = n;
    // console.log(JSON.stringify(n));
// });

// cursor.on('close', function() {
  // // Called when done
  // console.log('Loaded node count: ' + nodes.length);
// });

    // nodes["nurio009"] = {
        // nodeId: "nurio009" ,
        // inTopic : "nurio009_in",
        // outTopic : "nurio009_out"
    // };
};

// all environments
app.set('port', process.env.PORT || 80);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

// app.get('/:nodeId/digital/:pin/:value', function (req, res) {
    // console.log('nodeId : ' + req.params.nodeId);
    // console.log('pin    : ' + req.params.pin);
    // console.log('val    : ' + req.params.value);
    
    // var nodeId = req.params.nodeId;
    // var pin = req.params.pin;
    // var value = req.params.value;
    // //res.send(req.params);
    // noderes[req.params.nodeId] = {
        // nodeId: req.params.nodeId,
        // httpres : res
    // };
    // console.log("publishing to " + nodeId);
    // //console.log(".." + nodes[nodeId]);
    // var intopic = nodes[nodeId].inTopic;
    // var outTopic = nodes[nodeId].outTopic;
    // client.subscribe(outTopic);
    // client.publish(intopic, 'digital/' + pin + '/' + value);
// });

//performs a wake on lan to a mac
app.get('/wols', function (req, res) {
	
	wol.wake('58:8D:5C:4C:0A:65', function(error) {
	 if(error) {
		// handle error 
		res.send("WOL Error: " + error);
	  }
	  else{
		  res.send("WOL Sent");
	  }
	});	
});

app.get('/:nodeId/*', function (req, res) {
	var nodeId = req.params.nodeId;
	console.log("publishing to " + nodeId);
	var mqttReq = req.url.split(req.params.nodeId + '/' )[1];
	console.log('	request: ' + mqttReq);
	noderes[req.params.nodeId] = {
        nodeId: req.params.nodeId,
        httpres : res
    };
    
    //console.log(".." + nodes[nodeId]);
    var intopic = nodes[nodeId].inTopic;
    var outTopic = nodes[nodeId].outTopic;
    client.subscribe(outTopic);
    client.publish(intopic, mqttReq);
});

client.on('connect', function () {
    //client.subscribe('presence');
    client.subscribe('nurioregistrations');
	client.subscribe('kodicom');
    //client.publish('presence', 'Hello mqtt');
    console.log('Connected to mqtt server...');
});

client.on('message', function (topic, message) {
    // message is Buffer 
    var responseMessage = message.toString();
    console.log('Message Received: ' + responseMessage);
    
    if (topic === "nurioregistrations") {
        //add the node to the collection and save
        var n = JSON.parse(responseMessage);
        var node = new NodeModel({ Id: n.id, inTopic: n.intopic, outTopic: n.outtopic, chipId: n.chid });
		if(nodes[n.id] == null)
        {
			node.save(function (err) {
				if (err) {
					console.log(err);
				} else {
					console.log('saved node');
					loadNodes();
				}
			});
			
		}
		
		else {
			console.log('hi again, node exists');
		}
    } 
	else if (topic === "kodicom") {
		var urlBase = "http://" + kodiServer + "/" 
		var kodiBody = {};
		if(responseMessage == "jsonrpc?Input.Up"){
			kodiBody = {"jsonrpc":"2.0","method":"Input.Up","id":1};
		} 
		else if(responseMessage == "jsonrpc?Input.Down"){
			kodiBody = {"jsonrpc":"2.0","method":"Input.Down","id":1};
		} 
		else if(responseMessage == "jsonrpc?Input.Left"){
			kodiBody = {"jsonrpc":"2.0","method":"Input.Left","id":1};
		} 
		else if(responseMessage == "jsonrpc?Input.Right"){
			kodiBody = {"jsonrpc":"2.0","method":"Input.Right","id":1};
		} 
		else if(responseMessage == "jsonrpc?Input.Select"){
			kodiBody = {"jsonrpc":"2.0","method":"Input.Select","id":1};
		}
		else if(responseMessage == "jsonrpc?Input.Back"){
			kodiBody = {"jsonrpc":"2.0","method":"Input.Back","id":1};
		} 			
		else if(responseMessage == "jsonrpc?Player.PlayPause"){
			kodiBody = {"jsonrpc":"2.0","method":"Player.PlayPause","id":1, "params": {"playerid": 1}};
		}
		else if(responseMessage == "jsonrpc?Player.Stop"){
			kodiBody = {"jsonrpc":"2.0","method":"Player.Stop","id":1, "params": {"playerid": 1}};
		}
		
		
		var body = JSON.stringify(kodiBody);

		if(responseMessage!= "hello kodi" && body.length >0)
		{
			callback = function(response) {
			  var str = ''
			  response.on('data', function (chunk) {
				str += chunk;
			  });

			  response.on('end', function () {
				console.log(str);
			  });
			}

			var options = {
			  host: kodiServer,
			  port: kodiPort,
			  path: "/" + responseMessage,
			  method: 'POST',
			  headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(body)
				}

			};
			var req = http.request(options, callback);
			req.write(body);
			req.end();
		}
	
		

	}
	else {
        var mqRes = JSON.parse(responseMessage);
        
        if (noderes[mqRes.id] != null) {
            //ok we have to respond here
            console.log("ok we have to respond here");
            noderes[mqRes.id].httpres.send(mqRes);
            console.log("Response sent");
        }
    }

    //client.end();
});



http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
    //console.log('mqtt status:'+client.connected);
});
