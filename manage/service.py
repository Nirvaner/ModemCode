import socket
import subprocess
import sys
import os
import time

CurDir = "/devir/ModemCode/manage/"
DevirDir = "/devir/ModemCode/"

tcpClient = socket.socket()

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
def ConnectToServer():
        print "Connect to server"
        subprocess.call(["sudo","-u","root","-p","root","sakis3g","reconnect","-console"])
        global tcpClient
        try:
                tcpClient.close()
                tcpClient.connect((serverAddress,serverPort))
                tcpClient.send(info)
        except Exception as error:
                print error
                pass
                sys.exc_clear()
def SendToSiementsPY(s):
        try:
                siementsClient = socket.socket()
                siementsClient.connect(("127.0.0.1", 10002))
                siementsClient.send("0" + s)
                siementsClient.close()
        except Exception as error:
                print "Exception in SendToSiementsPY"
                print error
                pass
                sys.exc_clear()
def SendToSkdJS(s):
        try:
                skdClient = socket.socket()
                skdClient.connect(("127.0.0.1", 10003))
                skdClient.send(s)
                skdClient.close()
                return True
        except Exception as error:
                print "Exception in SendToSkdJS"
                print error
                pass
                sys.exc_clear()
                return False

info = GetStrFromFile(CurDir + "set").strip('\n').strip('\0')
serverAddress = info.split('|')[2]

serverPort = 10101

siementsSub = None
skdSub = None

pingInterval = 60
isConnect = False

print "Service started"

ConnectToServer()

while True:
        try:
                response = tcpClient.recv(1024)
                isConnect = True
                print response
                if response[0] == "0":
                        tcpClient.send("0")
                elif response[0:3] == "run":
                        if not(siementsSub):
                                siementsSub = subprocess.Popen(["sudo","-u","root","-p","root","python",CurDir + "siements.py"])
                                time.sleep(1)
                        if not(skdSub):
                                skdSub = subprocess.Popen(["sudo","-u","root","-p","root",DevirDir + "skd/NodeJs/bin/node",DevirDir + "skd/skd.js"])
                                time.sleep(20)
                        tcpClient.send("0")
                elif response[0:8] == "datetime":
                        subprocess.Popen(["sudo","-u","root","-p","root","date","-s",response[8:]])
                        tcpClient.send("0")
                elif response[0:8] == "settings":
                        SendToSiementsPY(response.strip("\0")[8:])
                        tcpClient.send("0")
                elif response[0:3] == "skd":
                        tcpClient.send(response[3:])
                        response = tcpClient.recv(int(response[3:]))
                        if SendToSkdJS(response):
                                tcpClient.send("0")
                        else:
                                tcpClient.send("1")
                elif response[0:7] == "address":
                        serverAddress = response.strip('\0')[7:]
                        SetServerAddress(serverAddress)
                        tcpClient.send("0")
                        ConnectToServer()
                elif response[0:6] == "reboot":
                        subprocess.Popen("sudo","-u","root","-p","root","reboot")
                elif response[0:6] == "update":
                        pathUpdate = "/devir/ModemCode/"
                        while True:
                                tcpClient.send("update")
                                path = tcpClient.recv(128).strip("\0")
                                tcpClient.send("0")
                                print "Path: " + path
                                size = tcpClient.recv(4)
                                tcpClient.send(size)
                                print "Size: " + size
                                code = tcpClient.recv(int(size))
                                arrPath = path.split('|')
                                if arrPath[-1] == "service.py":
                                        arrPath[-1] = "service"
                                        path = '/'.join(path)
                                        SetStrInFile(pathUpdate + path, code)
                                else:
                                        SetStrInFile(pathUpdate + path + ".update", code)
                                tcpClient.send("0")
                                print "File downloaded"
                                more = tcpClient.recv(16)
                                print more
                                if more == "over":
                                        print "Terminate all process and update"
                                        if packetSub:
                                                packetSub.terminate()
                                                packetSub = None
                                        if skdSub:
                                                skdSub.terminate()
                                                skdSub = None
                                        subprocess.call(["sudo","-u","root","-p","root","rename","-f","s/\.update$//", pathUpdate + "*"])
                                        tcpClient.send("over")
                                        if os.exists(CurDir + "service"):
                                                exit()
        except Exception as error:
                print error
                pass
                sys.exc_clear()
                ConnectToServer()