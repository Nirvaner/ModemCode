global.rootRequire = function (path) {
    return require(__dirname + '/' + path)
};
global.rootPath = __dirname + '/';

var net = new require('net');
var config = rootRequire('config.js');
var netServer = net.Socket();

var addressIndex = 0;
function ConnectToServer(){
    netServer.connect(config.ServicePort, config.Addresses[addressIndex], function () {
        console.log('Connected: ' + config.Addresses[addressIndex] + ':' + config.ServicePort);
        Manage();
    });
}
netServer.on('error', function () {
    console.log('Server not response: ' + config.Addresses[addressIndex]);
    if (addressIndex < config.Addresses.length - 1) {
        addressIndex++;
        ConnectToServer();
    }
    else {
        addressIndex = 0;
    }
});
netServer.on('close', function (){
   console.log('ServerSocket is closed..')
});
netServer.on('data', function(data){
    console.log(data.toString());
});

function Manage(){
    try{
        console.log('Manage');
    }
    catch(error){
        console.log('ErrorManage: ');
        console.log(error);
    }
}

ConnectToServer();