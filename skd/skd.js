var net = require('net');
var gpio = require("gpio");
var express = require('express');
var _ = require('underscore')._;
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
//----------------------- 
var objectName = '';
var skdUsers = [];

var currentUser = '0';

//showWaitingTimer=setInterval(function(){	
//	if(savedSocket!=null){
//             savedSocket.broadcast.emit('time', timeLeft);
//	console.log('sended data to client');
//	}
//},1000);

//Start static webServer on nodejs, __dirname - currentDir of this file
var tcpserver = net.createServer(function (c) { //'connection' listener
    c.on('data', function (data) {
        //
        var sData = data.toString();

        if (sData[0] == '0') {
            console.log("Выключаем сигнализацию!!!");
            //debug
            console.log('Alarm off');
            alarmSet = false;
            clearInterval(inputWaitingTimer);
            timeLeft = 60;
            disableSound();
            unBlinkLight();
            disableLight();
            sendToPython(doorState, alarmSet, alarmWorking, "0");
            if (waitingForDoorCloseInterval) {
                clearInterval(waitingForDoorCloseInterval);
                startedAlarmOnInterval = false;
            }
            isWaitingForInput = false;
            //debugend
        }
        else if (sData[0] == '1') {
            console.log("Включаем сигнализацию!!!");
            //debug
            console.log('Alarm on query');
            doorCloseTimeLeft = 60;
            if (!startedAlarmOnInterval) {
                startedAlarmOnInterval = true;
                blinkLight();
                //waitingForDoorCloseInterval = setInterval(function () {
                    //console.log(doorCloseTimeLeft + ' seconds to close door');
                    //doorCloseTimeLeft--;
                    //if (doorCloseTimeLeft < 0) doorCloseTimeLeft = 0;
                    //if (doorCloseTimeLeft < 1) {
                        console.log('Alarm on');
                        enableLight();
                        timeLeft = 60;
                        alarmSet = true;
                        sendToPython(doorState, alarmSet, alarmWorking, currentUser);
    
                        currentUser = '0';
    
                        isWaitingForInput = false;
                        clearInterval(waitingForDoorCloseInterval);
                        unBlinkLight();
                        startedAlarmOnInterval = false;
                        enableLight();
                    //}
                //}, 1000);
            }
            //debugend
        } else if (sData[0] == '2') {
            console.log("Получили настройки!");
            console.log(sData.substring(1));

            var arr = JSON.parse(sData.substring(1));
            //var skdNameElem = _.find(arr, function (elem) {
            //    return elem.Name = "FacilityName";
            //});
            objectName = arr[0].Value + " " + arr[1].Value;//skdNameElem.Value;
            console.log("Имя объекта: " + objectName);

        } else if (sData[0] == '3') {
            console.log("Получили CRUD операцию пользователей");
            console.log(sData.substring(1));

            var arr = JSON.parse(sData.substring(1));

            _.each(arr, function (elem) {
                if (elem.IsDeleted) {
                    skdUsers = _.reject(skdUsers, function (subElem) {
                        return subElem.Id == elem.Id;
                    });
                } else {

                    if (_.find(skdUsers, function (subElem) {
                        return subElem.Id == elem.Id;
                    }) == null) {
                        skdUsers.push(elem);
                    } else {
                        skdUsers = _.reject(skdUsers, function (subElem) {
                            return subElem.Id == elem.Id;
                        });
                        skdUsers.push(elem);
                    }
                }
            });
            _.each(skdUsers, function (elem) {
                console.log(elem.FirstName + " " + elem.Id);
            });
        }
    });
});

tcpserver.listen(10003, function () { //'listening' listener
    console.log('TCP server created');
});

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

app.use(express.static(__dirname));

io.on('connection', function (socket) {
    console.log('Connected client');
    savedSocket = socket;

    var showWaitingTimer = setInterval(function () {
        // console.log('Sending data to client');

        socket.emit('time', {
            objectName: objectName,
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
        var userPin = _.find(skdUsers, function (subElem) {
            return subElem.Pin == data;
        });
        if (userPin == null) {
            console.log("Неверный пин");
			socket.emit("pinerror",123);
            return;
        }
        else {
            currentUser = userPin.Id;
            console.log('Alarm off');
            alarmSet = false;
            clearInterval(inputWaitingTimer);
            timeLeft = 60;
            disableSound();
            unBlinkLight();
            disableLight();
            sendToPython(doorState, alarmSet, alarmWorking, currentUser);
            var userFullName = userPin.LastName + " " + userPin.FirstName.substr(0, 1) + ". " + userPin.FatherName.substr(0, 1) + ".";
            socket.emit("userName", userFullName);
            if (waitingForDoorCloseInterval) {
                clearInterval(waitingForDoorCloseInterval);
                startedAlarmOnInterval = false;
            }
            isWaitingForInput = false;
            //window.clearInterval(showWaitingTimer);
        }
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
                    sendToPython(doorState, alarmSet, alarmWorking, currentUser);

                    currentUser = '0';

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

        // setTimeout(function () {
        //     doorState = gpio11.val;
        // }, 1000);

        gpio11.on("change", function (val) {
            // value will report either 1 or 0 (number) when the value changes



            doorState = val;
            sendToPython(doorState, alarmSet, alarmWorking, currentUser);

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
                    sendToPython(doorState, alarmSet, alarmWorking, currentUser);
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
    // sendToPython();
}

function disableSound() {
    gpio23.set(0);
    alarmWorking = false;
    // sendToPython();
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

// var client = new net.Socket();
//     client.connect(10000, '127.0.0.1', function() {
//   client.write(""+doorState+""+alarmSet+""+alarmOn);
//     client.destroy(); 
//     });

function sendToPython(doorSt, alarmSt, alarmOnOff, currentUsr) {
    console.log("Sending to python");

    try {
        var client = net.connect({ port: 10002, host: "localhost" },
           function (c) {

               console.log('connected to python!');
               setTimeout(function () {


                   try {
                       console.log(doorSt);
                       console.log(alarmSt);
                       console.log(alarmOnOff);
                       var alarmSetf = 0;
                       if (alarmSt) {
                           alarmSetf = 1;
                       }

                       var sAlarmOnOff = 0;
                       if (alarmOnOff) {
                           sAlarmOnOff = 1;
                       }

                       console.log("1" + doorSt + "" + alarmSetf + "" + sAlarmOnOff + "" + currentUsr);

                       client.write("1" + doorSt + "" + alarmSetf + "" + sAlarmOnOff + "" + currentUsr, function () {
                           console.log('Sent to python');
                           client.destroy();
                       });
                   }
                   catch (error) {
                       // Tupo stroka
                   }
               }, 0);
           });
        client.on('error', function (data) {
            console.log(data.toString());
            client.end();
        });
    }
    catch (error) { }
}