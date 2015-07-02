global.rootRequire = function (path) {
    return require(__dirname + '/' + path)
};
global.rootPath = __dirname + '/';
global.config = {};

var fs = require('fs');
var _ = require('underscore')._;
var net = new require('net');
var spawn = require('child_process').spawn;
var gpio = require('gpio');

var connections = [];
var connectCount = 0;
var isError = false;
var currentOperation = '';

var ServerSocket = {};
var siements = {};
var skd = {};

modemPin = gpio.export(config.ModemPin, {
    direction: 'out',
    ready: function () {
        modemPin.set(0);
    }
});

function ModemReboot() {
    console.log('ModemReboot');
    modemPin.set(0);
    setTimeout(function () {
        modemPin.set(1);
        setTimeout(function () {
            fs.exists(config.ModemDevicePath, function (exists) {
                if (exists) {
                    SakisReconnect();
                } else {
                    ModemReboot();
                }
            });
        }, 10000);
    }, 1000);
}

function SakisReconnect() {
    spawn('sakis3g', ['reconnect'], {stdio: 'inherit'}).on('exit', function (code) {
        if (code == 0) {
            ConnectToServers();
        } else {
            setTimeout(function () {
                ConnectToServers();
            });//, 60000);
        }
    });
}

function ModemReconnect() {
    if (isError) {
        isError = false;
        ModemReboot();
    } else {
        isError = true;
        SakisReconnect();
    }
}

function SocketError(error) {
    console.log('Error in socketToServer: ' + error);
}
function SocketClose(index) {
    return function () {
        connections.splice(index, 1);
        connectCount++;
        console.log('Close in socketToServer');
        if (connectCount == config.Servers.length) {
            Run();
        }
    }
}
function SocketConnect(obj) {
    isError = false;
    return function () {
        clearTimeout(obj.timer);
        connectCount++;
        console.log('Connect in socketToServer ' + obj.index + ' ' + config.Servers[obj.index]);
        if (connectCount == config.Servers.length) {
            Run();
        }
    }
}

function ConnectToServers() {
    config.Servers.forEach(function (item, index) {
        var socket = net.connect({host: item, port: config.ServicePort});
        var timer = setTimeout(function () {
            socket.destroy();
        }, config.ServerTimeout);
        socket.on('error', SocketError);
        socket.on('close', SocketClose(index));
        socket.on('connect', SocketConnect({
            index: index
            , timer: timer
        }));
        connections.push(socket);
    });
}

console.log('Started');

fs.readFile(rootPath + 'config.json', 'utf8', function (error, data) {
    if (error) {
        console.log('Zander no started, config error: ' + error);
    } else {
        config = JSON.parse(data);
        ModemReconnect();
    }
});

function Run() {
    connections.forEach(function(socket){
        socket.on('close', function(){
            connectCount = 0;
        });
    });
    ServerSocket = connections.shift();
    for(var i = 0; i < connections.length; i++){
        connections.shift().destroy();
    }
    ServerSocket.on('close', function(){
        ModemReconnect();
    });
    console.log('Run');
    ServerSocket.write(config.ModemNumber + '|' + config.Version + '||' + (siements ? '0' : '1'));
    ServerSocket.on('data', function (data) {
        var strData = data.toString();
        if (currentOperation == '') {
            if (strData[0] == '0') {
                console.log('ping');
                ServerSocket.write('0');
            } else if (strData.substring(0, 3) == 'run') {
                console.log('run');
                skd = spawn('sudo', ['-u', 'root', '-p', 'root', 'node', rootPath + 'skd/skd.js'], {stdio: 'inherit'});
                skd.on('exit', function () {
                    console.log('Skd exit');
                    skd = null;
                });
                ServerSocket.write('0');
            } else if (strData.substring(0, 3) == 'skd') {
                console.log('skd');
                currentOperation = 'skd';
                ServerSocket.write(strData.substring(3));
            } else if (strData.substring(0, 6) == 'reboot') {
                console.log('reboot');
                ServerSocket.write('0');
                SysRestart();
            } else if (strData.substring(0, 8) == 'datetime') {
                console.log('datetime');
                spawn('sudo', ['-u', 'root', '-p', 'root', 'date', '-s', strData.substring(8)], {stdio: 'inherit'});
                ServerSocket.write('0');
            } else if (strData.substring(0, 8) == 'settings') {
                console.log('settings');
                if (siements) {
                    console.log('Siements kill');
                    siements.on('exit', function () {
                        setTimeout(function () {
                            ControllerSpawn();
                            console.log('Controller run');
                            SendToController(strData.substring(8));
                        }, 10000);
                    });
                    spawn('sudo', ['-u', 'root', '-p', 'root', 'kill', siements.pid], {stdio: 'inherit'});
                } else {
                    ControllerSpawn();
                    console.log('Controller run');
                    SendToController(strData.substring(8));
                }
            } else if (strData.substring(0, 7) == 'gitpull') {
                if (skd) {
                    spawn('sudo', ['-u', 'root', '-p', 'root', 'kill', skd.pid], {stdio: 'inherit'});
                }
                if (siements) {
                    siements.on('exit', function () {
                        GitPull();
                    });
                    spawn('sudo', ['-u', 'root', '-p', 'root', 'kill', siements.pid], {stdio: 'inherit'});
                } else {
                    GitPull();
                }
            } else {
                console.log('unresolved data: ' + strData);
            }
        } else {
            if (currentOperation == 'skd') {
                SendToSKD(strData);
                currentOperation = '';
            } else {
                console.log('unresolved data: ' + strData);
            }
        }
    });
}

function SysRestart() {
    spawn('sudo', ['-u', 'root', '-p', 'root', 'reboot'], {stdio: 'inherit'});
}

function ControllerSpawn() {
    siements = spawn('sudo', ['-u', 'root', '-p', 'root', 'python', rootPath + 'manage/siements.py'], {stdio: 'inherit'});
    siements.on('exit', function (code) {
        console.log('Siements exit with code ' + code);
        siements = null;
    });
}

function GitPull() {
    ServerSocket.write('0');
    ServerSocket.end();
    spawn('bash', [rootPath + '../gitpull.sh'], {stdio: 'inherit'});
    process.exit(0);
}

var isSkdError = false;
function SendToSKD(data) {
    console.log('Send to SKD');
    var netSkd = net.connect({host: 'localhost', port: config.SkdPort}, function () {
        setTimeout(function () {
            netSkd.write(data, function () {
                isSkdError = false;
                netSkd.destroy();
                ServerSocket.write('0');
            });
        }, 0);
    });
    netSkd.on('error', function () {
        netSkd.end();
        netSkd.destroy();
        if (isSkdError) {
            ServerSocket.write('1');
            isSkdError = false;
        } else {
            isSkdError = true;
            setTimeout(function () {
                SendToSKD(data);
            }, 10000);
        }
    });
}

var isControllerError = false;
function SendToController(data) {
    console.log('Send to controller');
    var netController = net.connect({host: 'localhost', port: config.ControllerPort}, function () {
        setTimeout(function () {
            netController.write(data, function () {
                isControllerError = false;
                netController.destroy();
                ServerSocket.write('0');
            });
        }, 0);
    });
    netController.on('error', function () {
        netController.end();
        netController.destroy();
        if (isControllerError) {
            ServerSocket.write('1');
            isControllerError = false;
        } else {
            isControllerError = true;
            setTimeout(function () {
                SendToController(data);
            }, 5000);
        }
    });
}