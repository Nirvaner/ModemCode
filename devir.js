var spawn = require('child_process').spawn;
var manage = spawn('node', [__dirname + 'manage.js']);
manage.stdout.on('data', function(data){
    console.log(data.toString());
});
manage.on('exit', function(code){
    console.log('Exit code: ' + code.toString());
});