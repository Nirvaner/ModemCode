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
    if (currentOperation == '') {
        if (s[0] == '0') {
            netServer.write('0');
        } else if (strData.substring(0, 3) == 'run') {
            skd = spawn('sudo', ['-u', 'root', '-p', 'root', 'node', rootPath + 'skd/skd.js']);
            netServer.write('0');
        } else if (strData.substring(0, 3) == 'skd') {
            currentOperation = 'skd';
            netServer.write(s.substring(3));
        } else if (strData.substring(0, 6) == 'reboot') {
            netServer.write('0');
            SysRestart();
        } else if (strData.substring(0, 8) == 'datetime') {
            netServer.write('0');
        } else if (strData.substring(0, 8) == 'settings') {
            if (siements) {
                siements.kill(0);
            }
            siements = spawn('sudo', ['-u', 'root', '-p', 'root', 'python', rootPath + 'manage/siements.py']);
            setTimeout(function () {
                SendToSiements(strData.substring(8));
            }, 5000);
        }
    } else {
        if (currentOperation == 'skd') {
            SendToSKD(strData);
            currentOperation = '';
        }
    }
});

var sendCount = 0;
function SendToSiements(data) {
    netSiements.connect({port: 10011, host: 'localhost'}, function () {
        netSiements.write(data, function () {
            netSiements.end();
            sendCount = 0;
            netServer.write('0');
        });
    });
    netSiements.on('error', function () {
        if (sendCount > 5) {
            sendCount = 0;
            netServer.write('1');
            netSiements.end();
        } else{
            sendCount++;
            setTimeout(function(){
                SendToSiements(data);
            }, 1000);
        }
    });
}

function SendToSKD(data) {
    netSkd.connect({port: 10012, host: 'localhost'}, function () {
        netServer.write('0');
        netSkd.write(data, function () {
            netSkd.end();
        });
    });
    netSkd.on('error', function () {
        netServer.write('1');
        netSkd.end();
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