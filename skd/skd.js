var net = require('net');
var fs = require('fs');
var gpio = require("gpio");
var express = require('express');
var _ = require('underscore')._;
//Ok
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 80;

var doorState = 0;
var alarmOn = 0;
var timeLeft = 60;
var doorCloseTimeLeft = 60;
var alarmSet = false;
var isWaitingForInput = false;
var inputWaitingTimer = null;
var waitingForDoorCloseInterval = null;
var startedAlarmOnInterval = false;
var alarmWorking = false;
var objectName = '';
var skdUsers = [];
var currentUser = '0';

app.use(express.static(__dirname));

server.listen(port, function () {
    console.log('Server listening at port %d', port);
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

function enableSound() {
    gpio23.set(1);
    alarmWorking = true;
}

function disableSound() {
    gpio23.set(0);
    alarmWorking = false;
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
    if (blinker != null){
        clearInterval(blinker);
        blinker = null;
    }
}

function sendToPython(doorSt, alarmSt, alarmOnOff, currentUsr) {
    try {
        var client = net.connect({ port: 10002, host: "localhost" },
            function (c) {
                setTimeout(function () {
                    try {
                        var alarmSetf = 0;
                        if (alarmSt) {
                            alarmSetf = 1;
                        }
                        var sAlarmOnOff = 0;
                        if (alarmOnOff) {
                            sAlarmOnOff = 1;
                        }
                        client.write("1" + doorSt + alarmSetf + sAlarmOnOff + currentUsr, function () {
                            client.destroy();
                        });
                    }
                    catch (error) { }
                }, 0);
            });
        client.on('error', function (data) {
            client.end();
        });
    }
    catch (error) { }
}

var gpio11 = gpio.export(17, {
    direction: "in",
    interval: 200,
    ready: function () {
        gpio11.on("change", function (val) {
            doorState = val;
			io.sockets.emit('doorIsClosed', gpio11.value);
            sendToPython(doorState, alarmSet, alarmWorking, currentUser);
            if (val == 0) {
                console.log("Открыли дверь");
            } else {
                console.log("Закрыли дверь");
            }
        });
    }
});

fs.readFile('/sys/class/gpio/gpio17/value', "utf-8", function(err, data) {
    if(err) {
        err.path = '/sys/class/gpio/gpio17/value';
        err.action = 'read';
        console.log(err);
    } else {
        doorState = parseInt(data, 10);
        console.log('fs doorState - ' + doorState);
    }
});

SetSignal = function(SignalOn){
    if (SignalOn){
        console.log("Включаем сигналку");
        timeLeft = 60;
        alarmSet = true;
        currentUser = '0';
        isWaitingForInput = false;
        if (waitingForDoorCloseInterval != null){
            clearInterval(waitingForDoorCloseInterval);
            waitingForDoorCloseInterval = null;
        }
        unBlinkLight();
        startedAlarmOnInterval = false;
        enableLight();
        sendToPython(doorState, alarmSet, alarmWorking, currentUser);
    }
    else{
        console.log("Выключаем сигналку");
        alarmSet = false;
        if (inputWaitingTimer != null){
            clearInterval(inputWaitingTimer);
            inputWaitingTimer = null;
        }
        timeLeft = 60;
        disableSound();
        unBlinkLight();
        disableLight();
        isWaitingForInput = false;
        if (waitingForDoorCloseInterval) {
            clearInterval(waitingForDoorCloseInterval);
            startedAlarmOnInterval = false;
        }
        sendToPython(doorState, alarmSet, alarmWorking, currentUser);
    }
}

var tcpserver = net.createServer(function (c) {
    c.on('data', function (data) {
        var sData = data.toString();
        if (sData[0] == '0') {
            SetSignal(false);
			io.sockets.emit('alarmDeactivated', null);
        }
        else if (sData[0] == '1') {
            SetSignal(true);
			io.sockets.emit('alarmActivated', 123);
        }
        else if (sData[0] == '2') {
            console.log("Получили настройки СКД!");
            var arr = JSON.parse(sData.substring(1));
            objectName = arr[0].Value + " " + arr[1].Value;
			io.sockets.emit('facilityName', objectName);
        }
        else if (sData[0] == '3') {
            console.log("Получили CRUD операцию пользователей");
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
        }
    });
});

tcpserver.listen(10003, function () {
    console.log('TCP server created');
});

SetSignal(false);

io.on('connection', function (socket) {
    console.log('Connected client');
	
	socket.emit('currentState', {
		doorState: doorState,
		alarmState: alarmSet,
		facilityName: objectName
	});
	socket.on('turnAlarmOn', function(){
		requirePincode(2);
	});
	socket.on('turnAlarmOff', function(){
		requirePincode(1);
	});
	socket.on('submitPin', function(data){
		
		var pinValue = data.pinValue;
		var code = data.code;
	
		var userPin = _.find(skdUsers, function (subElem) {
            return subElem.Pin == pinValue;
        });
        if(userPin == null){
            console.log("Неверный пин");
			socket.emit("pinFalse",123);
            return;
        }
		else if(code==1){
			currentUser = userPin.Id;
            SetSignal(false);
            var userFullName = "";
            if (currentUser != null){
                userFullName = userPin.LastName;
                if (userPin.FirstName != ""){
                    userFullName += " " + userPin.FirstName[0] + ".";
                }
                if (userPin.FatherName != ""){
                    userFullName += " " + userPin.FatherName[0] + ".";
                }
            }
            socket.emit("alarmDeactivated", userFullName);
            socket.broadcast.emit("alarmDeactivated", null);
		}
		else if(code==2){
			doorCloseTimeLeft = 60;
            if (!startedAlarmOnInterval) {
                startedAlarmOnInterval = true;
                blinkLight();
                waitingForDoorCloseInterval = setInterval(function () {
                    doorCloseTimeLeft--;
                    if (doorCloseTimeLeft < 0) doorCloseTimeLeft = 0;
                    if (doorCloseTimeLeft < 1) {
                        if (doorState == "0"){
                            socket.emit("alarmActivationFailed", 123);
                            socket.broadcast.emit("alarmActivationFailed", 123);
                            SetSignal(false);
                        }
                        else {
                            SetSignal(true);
                            socket.emit("alarmActivated", 123);
							socket.broadcast.emit('alarmActivated', 123);
                        }
                    }
					else{
						socket.emit('alarmActivateAfter', doorCloseTimeLeft);
						socket.broadcast.emit('alarmActivateAfter', doorCloseTimeLeft);
					}
                }, 1000);
            }
		}
		else if(code==3){
			socket.emit('facilityDetails', 123);
		}
		
	});
	socket.on('cancelAlarmActivation', function(){
		if(startedAlarmOnInterval){
			SetSignal(false);
			socket.emit('alarmActivationCancelled', 123);
			socket.broadcast.emit('alarmActivationCancelled', 123);
		}
	});
	socket.on('forcedAlarmActivation', function(){
		if(startedAlarmOnInterval){
			SetSignal(true);
			socket.emit('alarmActivated', 123);
			socket.broadcast.emit('alarmActivated', 123);
		}
	});
	socket.on('getFacilityDetails', function(){
		if(alarmSet){
			requirePincode(3);
		}
		else{
			socket.emit('facilityDetails', 123);
		}
	});
	
	function requirePincode(code){
		//Запросить пинкод у клиента
		//code (1 - Деактивировать сигнал. | 2 - Активировать сигнал. | 3 - Вкладка подробнее)
		socket.emit('enterPin',{
			code: code
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
                        enableSound();
                    }
					io.sockets.emit('dieAfter', timeLeft);
                }
            }, 1000);
        }
    }
}, 500);