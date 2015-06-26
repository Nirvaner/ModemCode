var spawn = require('child_process').spawn;
var manage = spawn('node', [__dirname + 'manage.js'], {stdio: 'inherit'});
manage.on('exit', function(code){
    console.log('Exit code: ' + code.toString());
});