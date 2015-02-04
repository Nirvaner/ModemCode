import os
import sys
import socket

initServerAddress = "192.168.66.100"

CurDir = "/devir/ModemCode/manage/"

tcpClient = socket.socket()
while True:
	try:
		tcpClient.connect((initServerAddress,9999))
		response = tcpClient.recv(256).strip('\0')
		print response
		tcpClient.send("0")
		tcpClient.close()
		f = open(CurDir + "set","w")
		f.write(response)
		f.close()
		f = (CurDir + "../start.sh")
		content = "#!bin/bash\nsudo -u root -p root python" + CurDir + "self.py &\nexit 0"
		f.write(content)
		f.close()
		break
	except Exception as error:
    	pass
    	sys.exc_clear()
    	print error