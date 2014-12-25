var net = require('net');
var gpio = require("gpio");
var express = require('express');
var app = express();
var doorState = 1;
var isWaitingForInput = false;
var alarmOn = 0;
var timeLeft = 60;
var doorCloseTimeLeft = 60;
var alarmSet = true;
var server = require('http').createServer(app);
var inputWaitingTimer = null;
//var showWaitingTimer = null;
var io = require('socket.io')(server);
var port = process.env.PORT || 80;
var waitingForDoorCloseInterval = null;
var startedAlarmOnInterval = false;
var savedSocket = null;
var alarmWorking = false;

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

//showWaitingTimer=setInterval(function(){	
//	if(savedSocket!=null){
//             savedSocket.broadcast.emit('time', timeLeft);
//	console.log('sended data to client');
//	}
//},1000);

//Start static webServer on nodejs, __dirname - currentDir of this file
app.use(express.static(__dirname));


var tcpserver = net.createServer(function(c) { //'connection' listener
  c.on('data', function(data) {
    console.log(data);
  });
});
tcpserver.listen(10001, function() { //'listening' listener
  console.log('TCP server');
});








io.on('connection', function (socket) {
    console.log('Connected client');
    savedSocket = socket;

    var showWaitingTimer = setInterval(function () {
        socket.broadcast.emit('time', {
            timeLeft: timeLeft,
            doorState: doorState,
            alarmState: alarmSet,
            isWaitingForInput: isWaitingForInput,
            doorWaiting: startedAlarmOnInterval,
            doorCloseTime: doorCloseTimeLeft
        });
    }, 1000);

    socket.on('disconnect', function () {
        clearInterval(showWaitingTimer);
    });

    socket.on('pin', function (data) {
        console.log('Alarm off');
        alarmSet = false;
         sendToPython(doorState, alarmSet, alarmWorking);
        clearInterval(inputWaitingTimer);
        timeLeft = 60;
        disableSound();
        unBlinkLight();
        disableLight();
        if (waitingForDoorCloseInterval) {
            clearInterval(waitingForDoorCloseInterval);
            startedAlarmOnInterval = false;
        }
        isWaitingForInput = false;
        //window.clearInterval(showWaitingTimer);
    });

    socket.on('alarmOn', function () {
        console.log('Alarm on query');
        doorCloseTimeLeft = 60;
        if (!startedAlarmOnInterval) {
            startedAlarmOnInterval = true;
            blinkLight();
            waitingForDoorCloseInterval = setInterval(function () {
                console.log(doorCloseTimeLeft + ' seconds to close door');
                doorCloseTimeLeft--;
                if (doorCloseTimeLeft < 0) doorCloseTimeLeft = 0;
                if (doorCloseTimeLeft < 1) {
                    console.log('Alarm on');
                    enableLight();
                    timeLeft = 60;
                    alarmSet = true;
                    sendToPython(doorState, alarmSet, alarmWorking);
                    isWaitingForInput = false;
                    clearInterval(waitingForDoorCloseInterval);
                    unBlinkLight();
                    startedAlarmOnInterval = false;
                    enableLight();
                }
            }, 1000);
        }
    });

});

var gpio23 = gpio.export(23, {
    direction: "out",
    ready: function () {
        gpio23.set(0);
    }
});

var gpio22 = gpio.export(22, {
    direction: "out",
    ready: function () {
        gpio22.set(0);
    }
});


var gpio11 = gpio.export(17, {
    direction: "in",
    interval: 200,
    ready: function () {

        if (savedSocket) {
            savedSocket.broadcast.emit('doorState', gpio11.val);
        }

        setTimeout(function () {
            doorState = gpio11.val;
        }, 1000);

        gpio11.on("change", function (val) {
            // value will report either 1 or 0 (number) when the value changes



            doorState = val;
            sendToPython(doorState, alarmSet, alarmWorking);

            if (val == 0) {
                console.log("Door open");


                //gpio22.set(1);
                //gpio23.set(1)
            } else {
                console.log("Door closed");
                //gpio22.set(0);
                //gpio23.set(0);
            }

        });
    }
});


setInterval(function () {
    if (!isWaitingForInput && alarmSet) {
        if (doorState == 0 && alarmSet && !isWaitingForInput) {
            console.log('lunching countdown timer');
            isWaitingForInput = true;
            blinkLight();
            inputWaitingTimer = setInterval(function () {
                if (alarmSet) {
                    timeLeft--;
                    if (timeLeft < 0) timeLeft = 0;
                    console.log('Waiting for user input.' + timeLeft + ' seconds left.');
                    if (timeLeft < 1) {
                        //gpio22.set(1);				
                        //gpio23.set(1);
                        enableSound();                        
                    }
                }
            }, 1000);
        }
    }
}, 500);


function enableSound() {
    gpio23.set(1);
    alarmWorking = true;
    sendToPython(doorState, alarmSet, true);
}

function disableSound() {
    gpio23.set(0);
    alarmWorking = false;
    sendToPython(doorState, alarmSet, false);
}

function enableLight() {
    gpio22.set(1)
}

function disableLight() {
    gpio22.set(0);
}


var blinker = null;
var blinkerStat = 0;
function blinkLight() {
    blinker = setInterval(function () {
        if (blinkerStat == 1)
            blinkerStat = 0;
        else blinkerStat = 1;
        gpio22.set(blinkerStat);
    }, 500);
}

function unBlinkLight() {
    clearInterval(blinker);
}


function sendToPython(doorState, alarmSet, alarmOn){
   console.log("Sending to python");

var client = net.connect({port: 10101, host: "192.168.66.134"},
    function() { 
  console.log('connected to python!');
  client.write(""+doorState+""+alarmSet+""+alarmOn, function(){
    console.log('Sent to python');
   client.destroy();   
  });  
});


// var client = new net.Socket();
//     client.connect(10000, '127.0.0.1', function() {
//   client.write(""+doorState+""+alarmSet+""+alarmOn);
//     client.destroy(); 
//     });

    
}
