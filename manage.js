global.rootRequire = function (path) {
    return require(__dirname + '/' + path)
};
global.rootPath = __dirname + '/';

var spawn = require('child_process').spawn;
function SysRestart() {
    spawn('sudo', ['-u', 'root', '-p', 'root', 'reboot']);
}

var net = new require('net');
var netServer = net.Socket();
var netSiements = net.Socket();
var netSkd = net.Socket();

var addressIndex = 0;
function ConnectToServer() {
    netServer.connect(config.ServicePort, config.Addresses[addressIndex]);
}
netServer.on('error', function () {
    console.log('Server not response: ' + config.Addresses[addressIndex]);
    if (addressIndex < config.Addresses.length - 1) {
        addressIndex++;
        ConnectToServer();
    }
    else {
        // Переподключаем модем
        addressIndex = 0;
    }
});
netServer.on('close', function () {
    console.log('ServerSocket is closed..')
});
netServer.on('connect', function () {
    console.log('Connected: ' + config.Addresses[addressIndex] + ':' + config.ServicePort);
    netServer.write(config.ModemNumber + '|' + config.Version + '||' + '1');
});
netServer.on('data', function (data) {
    var s = data.toString();
    if (s[0] == '0') {
        netServer.write('0');
    } else if (s.substring(0, 3) == 'run') {
        // Запустить скд и симентс
        netServer.write('0');
    } else if (s.substring(0, 3) == 'skd') {
        netServer.write('0');
    } else if (s.substring(0, 6) == 'reboot') {
        netServer.write('0');
        SysRestart();
    } else if (s.substring(0, 8) == 'datetime') {

    } else if (s.substring(0, 8) == 'settings') {

    }
});

function SendToSiements(data) {

}
function SendToSKD(data) {

}

function ModemRestart() {

}

var config = rootRequire('config.js')(ConnectToServer);