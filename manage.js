global.rootRequire = function (path) {
    return require(__dirname + '/' + path)
};
global.rootPath = __dirname + '/';
global.config = {};

const usbPath = '/sys/bus/usb/drivers/usb/';

var fs = require('fs');
var _ = require('underscore')._;
var net = new require('net');
var spawn = require('child_process').spawn;
var gpio = require('gpio');

var modemPin;
var connections = [];
var connectCount = 0;
var isError = false;
var currentOperation = '';
var pingTimer = null;

var ServerSocket = {};
var siements = null;
var skd = null;

console.log = function (data) {
    fs.exists(rootPath + 'log', function (exists) {
        if (exists) {
            fs.appendFile(rootPath + 'log', data + '\n', function (error) {
            });
        } else {
            fs.writeFile(rootPath + 'log', data + '\n', function (error) {
            });
        }
    });
    console.info(data);
};

function ModemReboot() {
    setTimeout(function() {
        try {
            console.log('ModemReboot');
            var dirs = fs.readdirSync(usbPath).filter(function (file) {
                return fs.statSync(usbPath + file).isDirectory();
            });
            dirs.forEach(function (dir) {
                if (fs.existsSync(usbPath + dir + '/idVendor') && fs.readFileSync(usbPath + dir + '/idVendor') == "12d1") {
                    fs.appendFileSync(usbPath + 'unbind', dir);
                }
            });
            setTimeout(function () {
                modemPin.set(0);
                setTimeout(function () {
                    try {
                        modemPin.set(1);
                        setTimeout(function () {
                            try {
                                fs.exists(config.ModemDevicePath, function (exists) {
                                    if (exists) {
                                        SakisReconnect();
                                    } else {
                                        ModemReboot();
                                    }
                                });
                            } catch (error) {
                                console.log('ErrorManageModemRebootDeviceExists: ' + error);
                            }
                        }, 10000);
                    } catch (error) {
                        console.log('ErrorManageModemRebootPinSet: ' + error);
                    }
                }, 1000);
            }, 1000);
        } catch (error) {
            console.log('ErrorManageModemReboot: ' + error);
        }
    });
}

function SakisReconnect() {
    setTimeout(function() {
        try {
            spawn('sakis3g', ['reconnect'], {stdio: 'inherit'}).on('exit', function (code) {
                if (code == 0) {
                    ConnectToServers();
                } else {
                    setTimeout(function () {
                        ConnectToServers();
                    });//, 60000);
                }
            });
        } catch (error) {
            console.log('ErrorManageSakisReconnect: ' + error);
        }
    });
}

function ModemReconnect() {
    setTimeout(function() {
        connectCount = 0;
        try {
            ServerSocket.destroy()
        } catch (error) {
        }
        try {
            console.log('ModemReconnect with: ' + isError);
            if (isError) {
                isError = false;
                ModemReboot();
            } else {
                isError = true;
                SakisReconnect();
            }
        } catch (error) {
            console.log('ErrorManageModemReconnect: ' + error);
        }
    });
}

function SocketError(error) {
    console.log('Error in socketToServer: ' + error);
}
function SocketClose(index) {
    return function () {
        try {
            connections.splice(index, 1);
            connectCount++;
            console.log('Close in socketToServer');
            if (connectCount == config.Servers.length) {
                Run();
            }
        } catch (error) {
            console.log('ErrorManageSocketClose: ' + error);
        }
    }
}
function SocketConnect(obj) {
    isError = false;
    return function () {
        try {
            clearTimeout(obj.timer);
            connectCount++;
            console.log('Connect in socketToServer ' + obj.index + ' ' + config.Servers[obj.index]);
            if (connectCount == config.Servers.length) {
                Run();
            }
        } catch (error) {
            console.log('ErrorManageSocketConnect: ' + error);
        }
    }
}

function ConnectToServers() {
    setTimeout(function() {
        try {
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
        } catch (error) {
            console.log('ErrorManageConnectToServers: ' + error);
        }
    });
}

console.log('Devir Zander for ASA started');

fs.readFile(rootPath + 'config.json', 'utf8', function (error, data) {
    if (error) {
        console.log('Zander no started, config error: ' + error);
    } else {
        try {
            config = JSON.parse(data);
            modemPin = gpio.export(config.ModemPin, {
                direction: 'out',
                ready: function () {
                    setTimeout(ModemReconnect, 10000);
                }
            });
        } catch (error) {
            console.log('ErrorManageReadConfig: ' + error);
        }
    }
});

function Run() {
    setTimeout(function() {
        try {
            if (connections.length == 0) {
                ModemReconnect();
                return;
            }
            connections.forEach(function (socket) {
                socket.on('close', function () {
                    connectCount = 0;
                });
            });
            ServerSocket = connections.shift();
            for (var i = 0; i < connections.length; i++) {
                connections.shift().destroy();
            }
            console.log('pingTimer is start');
            pingTimer = setTimeout(ModemReconnect, 90000);
            console.log('Run');
            ServerSocket.write(config.Zander + '|' + config.Version + '||' + (siements ? '0' : '1'));
            ServerSocket.on('data', function (data) {
                try {
                    if (pingTimer) {
                        console.log('pingTimer cleared');
                        clearTimeout(pingTimer);
                    }
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
                                        SendToController('0' + config.Zander + '|' + strData.substring(8));
                                    }, 10000);
                                });
                                spawn('sudo', ['-u', 'root', '-p', 'root', 'kill', siements.pid], {stdio: 'inherit'});
                            } else {
                                ControllerSpawn();
                                console.log('Controller run');
                                SendToController('0' + config.Zander + '|' + strData.substring(8));
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
                    console.log('pingTimer is start');
                    pingTimer = setTimeout(ModemReconnect, 120000);
                } catch (error) {
                    console.log('ErrorManageEventDataServer: ' + error);
                }
            });
        } catch (error) {
            console.log('ErrorManageRun: ' + error);
            ModemReconnect();
        }
    });
}

function SysRestart() {
    setTimeout(function() {
        try {
            spawn('sudo', ['-u', 'root', '-p', 'root', 'reboot'], {stdio: 'inherit'});
        } catch (error) {
            console.log('ErrorManageSysRestart: ' + error);
        }
    });
}

function ControllerSpawn() {
    try {
        siements = spawn('sudo', ['-u', 'root', '-p', 'root', 'python', rootPath + 'manage/siements.py'], {stdio: 'inherit'});
        siements.on('exit', function (code) {
            console.log('Siements exit with code ' + code);
            siements = null;
        });
    } catch (error) {
        console.log('ErrorManageControllerSpawn: ' + error);
    }
}

function GitPull() {
    setTimeout(function() {
        try {
            ServerSocket.write('0');
            ServerSocket.end();
            spawn('bash', [rootPath + '../gitpull.sh'], {stdio: 'inherit'});
            process.exit(0);
        } catch (error) {
            console.log('ErrorManageGitPull: ' + error);
        }
    });
}

var isSkdError = false;
function SendToSKD(data) {
    try {
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
    } catch (error) {
        console.log('ErrorManageSendToSKD: ' + error);
    }
}

var isControllerError = false;
function SendToController(data) {
    try {
        var netController = net.connect({host: 'localhost', port: config.ControllerPort}, function () {
            console.log('Send to controller');
            setTimeout(function () {
                netController.write(data, function () {
                    isControllerError = false;
                    netController.destroy();
                    ServerSocket.write('0');
                });
            }, 0);
        });
        netController.on('error', function () {
            console.log('Send to controller error');
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
    } catch (error) {
        console.log('ErrorManageSendToController: ' + error);
    }
}