var fs = require('fs');
var modemNumber = 0;
var version = 0;
fs.readFile(rootPath + 'set', 'utf8', function (error, data) {
    if (error){
        console.log('GetModemNumberError: ' + error);
    }else{
        var arr = data.split('\n');
        modemNumber = arr[0];
        version = arr[1];
    }
});
module.exports = {
    ModemNumber: modemNumber,
    Version: version,
    Addresses: [
        '89.218.66.54',
        'devir.kz',
        'localhost'
    ],
    ServicePort: 10001,
    PacketPort: 10002,
    ModemPin: 36,
    SoundPin: 15,
    LitePin: 16
};