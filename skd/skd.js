 var net = require('net');
 var fs = require('fs');
var gpio = require("gpio");
var express = require('express');
var _ = require('underscore')._;

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
var savedSocket = null;
var alarmWorking = false;
var objectName = '';
var skdUsers = [];
var currentUser = '0';

/*My Codes*/
fs.readFile('/sys/class/gpio/gpio17/value', "utf-8", function(err, data) {
	if(err) {
		err.path = file;
		err.action = 'read';
		console.log(err);
	} else {
		doorState = data;
		console.log('fs doorState - '+doorState);
	}
});

/*/My Codes*/

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
    if (blinker != null){
        clearInterval(blinker);
        blinker = null;
    }
}

function sendToPython(doorSt, alarmSt, alarmOnOff, currentUsr) {
    try {
        var client = net.connect({ port: 10002, host: "localhost" },
            function (c) {
                console.log("Send To packet")
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
                        console.log("Send to python: 1|" + doorSt + alarmSetf + sAlarmOnOff + currentUsr);
                        client.write("1" + doorSt + alarmSetf + sAlarmOnOff + currentUsr, function () {
                            client.destroy();
                        });
                    }
                    catch (error) { }
                }, 0);
            });
        client.on('error', function (data) {
            console.log(data.toString());
            client.end();
        });
    }
    catch (error) { }
}

var gpio11 = gpio.export(17, {
    direction: "in",
    interval: 200,
    ready: function () {
        //doorState = val;
        if (savedSocket) {
            savedSocket.broadcast.emit('doorState', gpio11.value);
			/*My Codes*/
			savedSocket.broadcast.emit('doorIsClosed', gpio11.value);
			savedSocket.emit('doorIsClosed', gpio11.value);
			/*/My Codes*/
        }
        gpio11.on("change", function (val) {
            doorState = val;
			/*My Codes*/
			if (savedSocket) {
				savedSocket.broadcast.emit('doorIsClosed', gpio11.value);
				savedSocket.emit('doorIsClosed', gpio11.value);
			}
			/*/My Codes*/
            sendToPython(doorState, alarmSet, alarmWorking, currentUser);
            if (val == 0) {
                console.log("Открыли дверь");
            } else {
                console.log("Закрыли дверь");
            }
        });
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
			/*My Codes*/
			if (savedSocket) {
				savedSocket.broadcast.emit('alarmDeactivated', null);
				savedSocket.emit('alarmDeactivated', null);
			}
			/*/My Codes*/
        }
        else if (sData[0] == '1') {
            SetSignal(true);
			/*My Codes*/
			if (savedSocket) {
				savedSocket.broadcast.emit('alarmActivated', 123);
				savedSocket.emit('alarmActivated', 123);
			}
			/*/My Codes*/
        }
        else if (sData[0] == '2') {
            console.log("Получили настройки СКД!");
            var arr = JSON.parse(sData.substring(1));
            objectName = arr[0].Value + " " + arr[1].Value;
			/*My Codes*/
			if (savedSocket) {
				savedSocket.broadcast.emit('facilityName', objectName);
				savedSocket.emit('facilityName', objectName);
			}
			/*/My Codes*/
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

SetSignal(false);

tcpserver.listen(10003, function () {
    console.log('TCP server created');
});

app.use(express.static(__dirname));

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

io.on('connection', function (socket) {
    console.log('Connected client');
    savedSocket = socket;
	
	/*My codes*/
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
		else if(code==1){//Активирована
			//Выключаем
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
		else if(code==2){//Дективирована
			//Включаем
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
	/*/My codes*/
	
	

	/*
    var showWaitingTimer = setInterval(function () {
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

    socket.on('pin', function (data) {//Здесь Мы Выключаем Сигналку
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
            socket.emit("userName", userFullName);
        }
    });

    socket.on('alarmOn', function (data) {//Здесь Мы Включаем Сигналку
        var userPin = _.find(skdUsers, function (subElem) {
            return subElem.Pin == data;
        });
        if (userPin == null) {
            console.log("Неверный пин");
            socket.emit("pinerror",123);
            return;
        }
        else{
            doorCloseTimeLeft = 60;
            if (!startedAlarmOnInterval) {
                startedAlarmOnInterval = true;
                blinkLight();
                waitingForDoorCloseInterval = setInterval(function () {
                    doorCloseTimeLeft--;
                    if (doorCloseTimeLeft < 0) doorCloseTimeLeft = 0;
                    if (doorCloseTimeLeft < 1) {
                        if (doorState == "0"){
                            socket.emit("unableToSetSignal", 123);
                            SetSignal(false);
                        }
                        else {
                            SetSignal(true);
                            socket.emit("turnOnSuccess", 123);
                        }
                    }
                }, 1000);
            }
        }
    });

    socket.on("alarmEnablingCancel", function () {
        SetSignal(false);
    });

    socket.on("alarmEnablingForced", function () {
        SetSignal(true);
    });*/
	
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
					savedSocket.emit('dieAfter', timeLeft);
					savedSocket.broadcast.emit('dieAfter', timeLeft);
                }
            }, 1000);
        }
    }
}, 500);