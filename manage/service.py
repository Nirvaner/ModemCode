import socket
import subprocess
import sys
import os

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
        tcpClient.connect((serverAddress,serverPort))
        tcpClient.send(info)
def SendToPacketPY(s):
        tcpClient = socket.socket()
        tcpClient.connect(("127.0.0.1", 10002))
        tcpClient.send(s)
        tcpClient.close()
def SendToSkdJS(s):
        tcpClient = socket.socket()
        tcpClient.connect(("127.0.0.1", 10003))
        tcpClient.send(s)
        tcpClient.close()

info = GetStrFromFile(CurDir + "set").strip('\n').strip('\0')
serverAddress = info.split('|')[2]

serverPort = 10101

siementsSub = "global"
skdSub = "global"

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
                        print siementsSub
                        if not(siementsSub):
                                print "try run siements"
                                siementsSub = subprocess.Popen(["sudo","-u","root","-p","root","python",CurDir + "siements.py"])
                        print skdSub
                        if not(skdSub):
                                print "try run skd"
                                skdSub = subprocess.Popen(["sudo","-u","root","-p","root",DevirDir + "skd/NodeJs/bin/node",DevirDir + "skd.js"])
                elif response[0:8] == "datetime":
                        subprocess.Popen(["sudo","-u","root","-p","root","date","-s",response[8:]])
                        tcpClient.send("0")
                elif response[0:8] == "settings":
                        SendToSiementsPY(response.strip("\0")[8:])
                        tcpClient.send("0")
                elif response[0:7] == "address":
                        serverAddress = response.strip('\0')[7:]
                        SetServerAddress(serverAddress)
                        tcpClient.send("0")
                        ConnectToServer()
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