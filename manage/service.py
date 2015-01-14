import socket
import subprocess
import sys
import os

CurDir = "/devir/ModemCode/Python/"

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

def ConnectToServer():
        print "Connect to server"
        subprocess.call(["sudo","-u","root","-p","root","sakis3g","reconnect","-console"])
        global tcpClient
        tcpClient.connect((serverAddress,serverPort))

def SendToPacketPY(s):
        tcpClient = socket.socket()
        tcpClient.connect(("127.0.0.1", 10002))

def SendToSkdJS(s):
        tcpClient = socket.socket()
        tcpClient.connect(("127.0.0.1", 10003))

modemNumber = int(GetStrFromFile(CurDir + "id"))
serverAddress = GetStrFromFile(CurDir + "data/ServiceServer")
version = int(GetStrFromFile(CurDir + "Version"))
serverPort = 10101

packetSub = "global"
skdSub = "global"

pingInterval = 60
isConnect = false

print "Service started"

ConnectToServer()

while True:
        try:
                response = tcpClient.recv(16)
                isConnect = True
                print response

                if response[0] == "0":
                        tcpClient.send("0")

                elif response[0:7] == "getinfo":
                        tcpClient.send('|'.join(str(modemNumber),str(version),serverAddress))

                elif response[0:8] == "settings":
                        SendToPacketPY(response.strip("\0")[8:])
                        tcpClient.send("0")

                elif response[0:7] == "address":
                        serverAddress = response.strip('\0')[7:]
                        SetStrInFile(CurDir + "data/ServerAddress",serverAddress)
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
                                        if skdSub:
                                                skdSub.terminate()
                                        subprocess.call(["sudo","-u","root","-p","root","rename","-f","s/\.update$//", pathUpdate + "*"])
                                        tcpClient.send("over")
                                        if os.exists(CurDir + "service"):
                                                exit()

        except Exception as error:
                print error
                pass
                sys.exc_clear()
                ConnectToServer()