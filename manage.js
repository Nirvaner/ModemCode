global.rootRequire = function (path) {
    return require(__dirname + '/' + path)
};
global.rootPath = __dirname + '/';

var spawn = require('child_process').spawn;
var siements;
var skd;

function SysRestart() {
    spawn('sudo', ['-u', 'root', '-p', 'root', 'reboot'], {stdio: 'inherit'});
}

var net = new require('net');
var netServer = net.Socket();

var addressIndex = 0;
var isSakisReconnected = false;
netServer.on('error', function () {
    console.log('Server not response: ' + config.Addresses[addressIndex]);
    if (addressIndex < config.Addresses.length - 1) {
        addressIndex++;
        netServer.connect(config.ServicePort, config.Addresses[addressIndex]);
    }
    else {
        addressIndex = 0;
        if (isSakisReconnected) {
            isSakisReconnected = false;
            modemPin.set(0);
            setTimeout(function () {
                modemPin.set(1);
                var sakis = spawn('sudo', ['-u', 'root', '-p', 'root', 'sakis3g', 'reconnect'], {stdio: 'inherit'});
                sakis.on('exit', function (code) {
                    console.log('Sakis exitCode: ' + code);
                    netServer.connect(config.ServicePort, config.Addresses[addressIndex]);
                });
            }, 1000);
        }
        else {
            isSakisReconnected = true;
            var sakis = spawn('sudo', ['-u', 'root', '-p', 'root', 'sakis3g', 'reconnect'], {stdio: 'inherit'});
            sakis.on('exit', function (code) {
                console.log('Sakis exitCode: ' + code);
                netServer.connect(config.ServicePort, config.Addresses[addressIndex]);
            });
        }
    }
});
netServer.on('close', function () {
    console.log('ServerSocket is closed..')
});
netServer.on('connect', function () {
    console.log('Connected: ' + config.Addresses[addressIndex] + ':' + config.ServicePort);
    netServer.write(config.ModemNumber + '|' + config.Version + '||' + (siements ? '0' : '1'));
});

var currentOperation = '';
netServer.on('data', function (data) {
    var strData = data.toString();
    if (currentOperation == '') {
        if (strData[0] == '0') {
            console.log('ping');
            netServer.write('0');
        } else if (strData.substring(0, 3) == 'run') {
            console.log('run');
            skd = spawn('sudo', ['-u', 'root', '-p', 'root', 'node', rootPath + 'skd/skd.js'], {stdio: 'inherit'});
            skd.on('exit', function () {
                console.log('Skd exit');
                skd = null;
            });
            netServer.write('0');
        } else if (strData.substring(0, 3) == 'skd') {
            console.log('skd');
            currentOperation = 'skd';
            netServer.write(strData.substring(3));
        } else if (strData.substring(0, 6) == 'reboot') {
            console.log('reboot');
            netServer.write('0');
            SysRestart();
        } else if (strData.substring(0, 8) == 'datetime') {
            console.log('datetime');
            spawn('sudo', ['-u', 'root', '-p', 'root', 'date', '-s', strData.substring(8)]);
            netServer.write('0');
        } else if (strData.substring(0, 8) == 'settings') {
            console.log('settings');
            if (siements) {
                console.log('Siements kill');
                siements.on('exit', function(){
                    setTimeout(function(){
                        siements = spawn('sudo', ['-u', 'root', '-p', 'root', 'python', rootPath + 'manage/siements.py'], {stdio: 'inherit'});
                        siements.on('exit', function (code) {
                            console.log('Siements exit with code ' + code);
                            siements = null;
                        });
                        console.log('Controller run');
                        SendToController(strData.substring(8));
                    }, 1000);
                });
                spawn('sudo', ['-u', 'root', '-p', 'root', 'kill', siements.pid], {stdio: 'inherit'});
            } else{
                siements = spawn('sudo', ['-u', 'root', '-p', 'root', 'python', rootPath + 'manage/siements.py'], {stdio: 'inherit'});
                siements.on('exit', function (code) {
                    console.log('Siements exit with code ' + code);
                    siements = null;
                });
                console.log('Controller run');
                SendToController(strData.substring(8));
            }
        } else if (strData.substring(0, 7) == 'gitpull') {
            if (skd) {
                spawn('sudo', ['-u', 'root', '-p', 'root', 'kill', skd.pid], {stdio: 'inherit'});
            }
            if (siements) {
                spawn('sudo', ['-u', 'root', '-p', 'root', 'kill', siements.pid], {stdio: 'inherit'});
            }
            netServer.write('0');
            netServer.end();
            spawn('bash', [rootPath + '../gitpull.sh'], {stdio: 'inherit'});
            process.exit(0);
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

var isSkdError = false;
function SendToSKD(data) {
    console.log('Send to SKD');
    var netSkd = net.connect({host: 'localhost', port: config.SkdPort}, function () {
        setTimeout(function () {
            netSkd.write(data, function () {
                isSkdError = false;
                netSkd.destroy();
                netServer.write('0');
            });
        }, 0);
    });
    netSkd.on('error', function () {
        netSkd.end();
        netSkd.destroy();
        if (isSkdError) {
            netServer.write('1');
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
                netServer.write('0');
            });
        }, 0);
    });
    netController.on('error', function () {
        netController.end();
        netController.destroy();
        if (isControllerError) {
            netServer.write('1');
            isControllerError = false;
        } else {
            isControllerError = true;
            setTimeout(function () {
                SendToController(data);
            }, 5000);
        }
    });
}

var gpio = require('gpio');
var modemPin;
var config = rootRequire('config.js')(function () {
    modemPin = gpio.export(config.ModemPin, {
        direction: 'out',
        ready: function () {
            modemPin.set(1);
        }
    });
    setTimeout(function(){
        var sakis = spawn('sudo', ['-u', 'root', '-p', 'root', 'sakis3g', 'connect']);
        sakis.on('exit', function(){
            netServer.connect(config.ServicePort, config.Addresses[addressIndex]);
        });
    }, 5000);
});