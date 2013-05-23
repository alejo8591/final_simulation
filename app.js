
/**
 * Module dependencies.
 */

var express = require('express')
  // instancia del framework para crear el objeto express
  , app = express()
  // modulo http para el control de request y responses en HTML1.01
  , http = require('http')
  // Instancia para crear el servidor
  , server = http.createServer(app)
  // Creación del objeto socket.io para gestionar los sockets
  , socketio = require('socket.io')
  // Instanciando el socket
  , io = socketio.listen(server)
  // Clases del MVC utilizadas
  , routes = require('./routes')
  , user = require('./routes/user')
  , path = require('path')
  // Libreria para el encriptado AES
  , aes = require('./aes/aes')
  // Valores para aes
  , pw = 'c00p3r6aykey7yaslasapd1ltdc00p3r'
  , cip = 256
  // route o controlador del MVC para la clase chat
  , chat = require('./routes/chat');

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// rutas de las URL para la aplicación
app.get('/', routes.index);
app.get('/chat', chat.main);
app.get('/users', user.list);

var clients = {}, 
	socketsOfClients = {};

io.sockets.on('connection', function(socket) {
  socket.on('set username', function(userName) {
    // Is this an existing user name?
    if (clients[userName] === undefined) {
      // Does not exist ... so, proceed
      clients[userName] = socket.id;
      socketsOfClients[socket.id] = userName;
      userNameAvailable(socket.id, userName);
	  userJoined(userName);
    } else
    if (clients[userName] === socket.id) {
      // Ignore for now
    } else {
      userNameAlreadyInUse(socket.id, userName);
    }
  });

  socket.on('message', function(msg) {
    console.log('el mensaje que envia el usuario encriptrado en AES es: '+msg.message);
    console.log('el mensaje que envia el usuario desencriptado en AES es: '+aes.decrypt(msg.message, pw, cip));
    msg.message = aes.decrypt(msg.message, pw, cip);
    var srcUser;
    if (msg.inferSrcUser) {
      // Infer user name based on the socket id
      srcUser = socketsOfClients[socket.id];
    } else {
      srcUser = msg.source;
    }
    if (msg.target == "All") {
      // broadcast
      io.sockets.emit('message',
          {"source": srcUser,
           "message": aes.encrypt(msg.message, pw, cip),
           "target": msg.target});
    } else {
      // Look up the socket id
      io.sockets.sockets[clients[msg.target]].emit('message', 
          {"source": srcUser,
           "message": msg.message,
           "target": msg.target});
    }
  });

  socket.on('disconnect', function() {
		  var uName = socketsOfClients[socket.id];
		  delete socketsOfClients[socket.id];
	    delete clients[uName];
		// relay this message to all the clients
		userLeft(uName);
	  });
});

function userJoined(uName) {
	Object.keys(socketsOfClients).forEach(function(sId) {
		io.sockets.sockets[sId].emit('userJoined', { "userName": uName });
	})
}

function userLeft(uName) {
    io.sockets.emit('userLeft', { "userName": uName });
}

function userNameAvailable(sId, uName) {
  setTimeout(function() {
    console.log('Sending welcome msg to ' + uName + ' at ' + sId);

    io.sockets.sockets[sId].emit('welcome', { "userName" : uName, "currentUsers": JSON.stringify(Object.keys(clients)) });
  }, 500);
}

function userNameAlreadyInUse(sId, uName) {
  setTimeout(function() {
    io.sockets.sockets[sId].emit('error', { "userNameInUse" : true });
  }, 500);
}
// Instancia para correr el servidor
server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
