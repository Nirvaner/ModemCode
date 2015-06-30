var fs = require('fs');
var config = {
    ModemNumber: 0
    , Version: 0,
    Addresses: [
        '89.218.66.54'
        , 'devir.kz'
        , '192.168.66.100'
    ]
    , ServicePort: 10001
    , PacketPort: 10002
    , SkdPort: 10012
    , ControllerPort: 10011
    , ModemPin: 16
    , SoundPin: 22
    , LightPin: 23
    , DoorPin: 17
    , ModemDevicePath: '/dev/ttyUSB2' // for TP-LINK
    //, ModemDevicePath: '/dev/ttyUSB0' // for other modems
};
module.exports = function(callback) {
    fs.readFile(rootPath + 'set', 'utf8', function (error, data) {
        if (error) {
            console.log('GetModemNumberError: ' + error);
        } else {
            var arr = data.split('\n');
            config.ModemNumber = arr[0];
            config.Version = arr[1];
            callback();
        }
    });
    return config;
};