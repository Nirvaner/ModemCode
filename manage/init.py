import time
import socket
import sys
import subprocess
import os

def SystemReboot():
        subprocess.popen(["sudo","-u","root","-p","root","reboot"])

def GetId():
        fId = open(CurDir + "id","r")
        res = fId.read()
        fId.close()
        return int(res)

def SetId(id):
	fId = open(CurDir + "id","w")
	fId.write(str(id))
	fId.close()

def SetServiceServer(ServiceServer):
        f = open(CurDir + "data/ServiceServer","w")
        f.write(ServiceServer)
        f.close()

def SetStartPy(currentPy):
        sh = open("/home/pi/Start.sh","w")
        sh.write("#!bin/bash" + '\n')
        sh.write("sudo -u root -p root python " + CurDir + currentPy + ".py &" + '\n')
        sh.write("exit 0")
        sh.close()

CurDir = "/home/pi/Python/"
id = GetId()

serverAddress = "10.0.0.10"
serverPort = 10000

serviceServer = ""

print "Init start"

while True:
	print "Querying ID"
	try:
       		scfg = socket.socket()
       		scfg.connect((serverAddress, serverPort))
       		scfg.send(str(id))
		settings = scfg.recv(1024)
		setArr = settings.split("|")
		id = setArr[0].strip('\0')
		serviceServer = setArr[1].strip('\0')
       		print "My ID is: " + str(id)
		print "My ServiceServer " + serviceServer
       		scfg.close
		break
	except Exception:
	        pass
	        sys.exc_clear()
		print "Querying ID is failed"
		time.sleep(1)

print "Write Id and ServiceServer in this system"
SetId(id)
SetServiceServer(serviceServer)
print "ModemID is " + str(id)
print "ServiceServer is " + serviceServer
SetStartPy("service")
