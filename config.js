var fs = require('fs');
var config = {
    ModemNumber: 0,
    Version: 0,
    Addresses: [
        //'89.218.66.54',
        //'devir.kz',
        'localhost'
    ],
    ServicePort: 10001,
    PacketPort: 10002,
    ModemPin: 36,
    SoundPin: 15,
    LitePin: 16
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
}