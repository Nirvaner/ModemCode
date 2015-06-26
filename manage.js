global.rootRequire = function (path) {
    return require(__dirname + '/' + path)
};
global.rootPath = __dirname + '/';

var spawn = require('child_process').spawn;
var siements;
var skd;

function SysRestart() {
    spawn('sudo', ['-u', 'root', '-p', 'root', 'reboot']);
}

var net = new require('net');
var netServer = net.Socket();
var netSkd = net.Socket();
var netSiements = net.Socket();

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
                var sakis = spawn('sudo', ['-u', 'root', '-p', 'root', 'sakis3g', 'reconnect']);
                sakis.on('exit', function (code) {
                    console.log('Sakis exitCode: ' + code);
                    netServer.connect(config.ServicePort, config.Addresses[addressIndex]);
                });
            }, 1000);
        }
        else {
            isSakisReconnected = true;
            var sakis = spawn('sudo', ['-u', 'root', '-p', 'root', 'sakis3g', 'reconnect']);
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
    console.log('DataFromServer: ' + strData);
    if (currentOperation == '') {
        if (strData[0] == '0') {
            console.log('ping');
            netServer.write('0');
        } else if (strData.substring(0, 3) == 'run') {
            console.log('run');
            //skd = spawn('sudo', ['-u', 'root', '-p', 'root', 'node', rootPath + 'skd/skd.js']);
            //skd.stdout.on('data', function (data) {
            //    console.log(data);
            //});
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
            netServer.write('0');
        } else if (strData.substring(0, 8) == 'settings') {
            console.log('settings');
            if (siements) {
                console.log('siements kill');
                siements.kill(0);
            }
            //siements = spawn('sudo', ['-u', 'root', '-p', 'root', 'python', rootPath + 'manage/siements.py']);
            //siements.stdout.on('data', function (data) {
            //    console.log(data);
            //});
            console.log('siements run');
            setTimeout(function () {
                SendToSiements(strData.substring(8));
            }, 5000);
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

function SendToSiements(data) {
    console.log('send to siements');
    netSiements.connect({port: 10011, host: 'localhost'}, function () {
        netSiements.write(data, function () {
            netSiements.end();
            sendCount = 0;
            netServer.write('0');
        });
    });
    netSiements.on('error', function () {
            netServer.write('1');
            netSiements.end();
    });
}

function SendToSKD(data) {
    netSkd.connect({port: 10012, host: 'localhost'}, function () {
        netSkd.write(data, function () {
            netSkd.end();
            netServer.write('0');
        });
    });
    netSkd.on('error', function () {
        netSkd.end();
        netServer.write('1');
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
    netServer.connect(config.ServicePort, config.Addresses[addressIndex]);
});