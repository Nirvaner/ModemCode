import socket
import subprocess
import sys
import os
import time
import threading
import RPi.GPIO as gpio

CurDir = "/devir/ModemCode/manage/"
DevirDir = "/devir/ModemCode/"
serverPort = 10101
modemPin = 16

def SystemReboot():
        subprocess.popen(["sudo","-u","root","-p","root","reboot"])

def GetStrFromFile(path):
        f = open(path,"r")
        res = f.read()
        f.close()
        return res.strip('\n')

def SetStrInFile(path,s):
        f = open(path,"w")
        f.write(s)
        f.close()

def SetServerAddress(address):
        path = CurDir + "set"
        content = GetStrFromFile(path)
        arrContent = content.split('|')
        arrContent[-1] = address
        content = '|'.join(arrContent)
        SetStrInFile(path,content)

gpio.setmode(gpio.BCM)
gpio.setup(modemPin, gpio.OUT)

# Transistor
gpio.output(modemPin, True)
def ModemReboot():
         global gpio
         gpio.output(modemPin, False)
         time.sleep(5)
         gpio.output(modemPin, True)

# Rele
#def ModemReboot():
#        global gpio
#        gpio.output(modemPin, True)
#        time.sleep(5)
#        gpio.output(modemPin, False)

ModemError = True
def ConnectToServer(isFirstConnect):
        global ModemError
        global tcpClient
        print "Connect to server"
        if ModemError:
                ModemReboot()
                ModemError = False
                time.sleep(10)
        else:
                ModemError = True
        subprocess.call(["sudo","-u","root","-p","root","sakis3g","connect"])
        global tcpClient
        try:
                tcpClient = socket.socket()
                tcpClient.connect((serverAddress,serverPort))
                tcpClient.send(info + "|" + isFirstConnect)
        except Exception as error:
                print "Service>ConnectToServer: " + str(error)
                pass
                sys.exc_clear()

def SendToSiementsPY(s):
        try:
                siementsClient = socket.socket()
                siementsClient.connect(("127.0.0.1", 10002))
                siementsClient.send(s)
                siementsClient.close()
                return True
        except Exception as error:
                print "Service>SendToSiementsPY: " + str(error)
                pass
                sys.exc_clear()
                return False

def SendToSkdJS(s):
        try:
                skdClient = socket.socket()
                skdClient.connect(("127.0.0.1", 10003))
                skdClient.send(s)
                skdClient.close()
                return True
        except Exception as error:
                print "Service>SendToSkdJS: " + str(error)
                pass
                sys.exc_clear()
                return False

info = GetStrFromFile(CurDir + "set").strip('\n').strip('\0')

print "Service started"

if not os.path.exists(CurDir + "addresses"):
        SetStrInFile(CurDir + "addresses", "89.218.66.54|devir.kz");
serverAddresses = GetStrFromFile(CurDir + "addresses").split("|");
serverAddress = serverAddresses[0];

tcpClient = None

ConnectToServer("1")

siementsSub = None
skdSub = None

while True:
        try:
                tcpClient.settimeout(60)
                response = tcpClient.recv(1024).strip('\0')
                tcpClient.settimeout(None)
                ModemError = False
                if response == "":
                        ConnectToServer("1")
                elif response[0] == "0":
                        tcpClient.send("0")
                        print "Ping ok"
                elif response[0:3] == "run":
                        if not(skdSub):
                                skdSub = subprocess.Popen(["sudo","-u","root","-p","root",DevirDir + "skd/NodeJs/bin/node",DevirDir + "skd/skd.js"])
                                time.sleep(20)
                        tcpClient.send("0")
                elif response[0:8] == "datetime":
                        subprocess.Popen(["sudo","-u","root","-p","root","date","-s",response[8:]])
                        tcpClient.send("0")
                elif response[0:8] == "settings":
                        if siementsSub:
                                siementsSub.terminate()
                                siementsSub.wait()
                        siementsSub = subprocess.Popen(["sudo","-u","root","-p","root","python",CurDir + "siements.py"])
                        i = 0
                        while True:
                                if SendToSiementsPY(response[8:]):
                                        tcpClient.send("0")
                                        break
                                time.sleep(1)
                                i = i + 1
                                if i > 10:
                                        tcpClient.send("1")
                                        break
                elif response[0:3] == "skd":
                        tcpClient.send(response[3:])
                        response = tcpClient.recv(int(response[3:]))
                        if SendToSkdJS(response):
                                tcpClient.send("0")
                        else:
                                tcpClient.send("1")
                elif response[0:7] == "address":
                        serverAddress = response[7:]
                        SetServerAddress(serverAddress)
                        tcpClient.send("0")
                        ConnectToServer("1")
                elif response[0:6] == "reboot":
                        tcpClient.send("0")
                        subprocess.Popen(["sudo","-u","root","-p","root","reboot"])
                elif response[0:8] == "siements":
                        if SendToSiementsPY(response[8:]):
                                tcpClient.send("0")
                        else:
                                tcpClient.send("1")
                elif response[0:7] == "gitpull":
                        if siementsSub:
                                siementsSub.terminate()
                                siementsSub = None
                        if skdSub:
                                skdSub.terminate()
                                skdSub = None
                        tcpClient.send("0")
                        subprocess.Popen(["sudo","-u","root","-p","root","bash","/devir/gitpull.sh"])
                        print "Git pull"
                        exit()
                elif response[0:6] == "update":
                        pathUpdate = "/devir/ModemCode/"
                        while True:
                                tcpClient.send("update")
                                path = tcpClient.recv(128).strip('\0')
                                tcpClient.send("0")
                                print "Path: " + path
                                size = tcpClient.recv(4).strip('\0')
                                tcpClient.send(size)
                                print "Size: " + size
                                code = tcpClient.recv(int(size)).strip('\0')
                                arrPath = path.split('/')
                                if arrPath[-1] == "service.py":
                                        arrPath[-1] = "service"
                                        path = '/'.join(path)
                                        SetStrInFile(pathUpdate + path, code)
                                else:
                                        SetStrInFile(pathUpdate + path + ".update", code)
                                tcpClient.send("0")
                                print "File downloaded"
                                more = tcpClient.recv(16).strip('\0')
                                print more
                                if more == "over":
                                        print "Terminate all process and update"
                                        if siementsSub:
                                                siementsSub.terminate()
                                                siementsSub = None
                                        if skdSub:
                                                skdSub.terminate()
                                                skdSub = None
                                        subprocess.call(["sudo","-u","root","-p","root","rename","-f","s/\.update$//", pathUpdate + "*"])
                                        tcpClient.send("over")
                                        if os.exists(CurDir + "service"):
                                                exit()
        except Exception as error:
                print "Service: " + str(error)
                pass
                sys.exc_clear()
                if siementsSub:
                        ConnectToServer("1")
                else:
                        ConnectToServer("0")