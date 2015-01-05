import time
import socket
import subprocess
import sys
import os

CurDir = "/devir/ModemCode/Python/"

def Connect3g():
        subprocess.call(["sudo","-u","root","-p","root","sakis3g","reconnect","-console"])

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

def GetId():
        return GetStrFromFile(CurDir + "id")

def GetServiceServer():
        return GetStrFromFile(CurDir + "data/ServiceServer")

def GetVersion():
        return GetStrFromFile(CurDir + "Version")

Id = GetId()
version = GetVersion()
serverAddress = GetServiceServer()
serverPort = 10101

print "Service started"
while True:
        try:
                print "Connect to 3g"
                Connect3g()

                tcpClient = socket.socket()
                tcpClient.connect((serverAddress,serverPort))
                tcpClient.send("|".join([Id, version, serverAddress]))

                response = tcpClient.recv(16).strip('\0')
                print response

                if response == "update":
                        pathUpdate = "/devir/ModemCode/"
                        while True:
                                path = tcpClient.recv(128).strip('\0')
                                tcpClient.send("0")
                                print "path" + path

                                size = tcpClient.recv(4)
                                tcpClient.send(size)
                                print size

                                code = tcpClient.recv(int(size))
                                SetStrInFile(pathUpdate + path, code)
                                tcpClient.send("0")
                                print "File updated"

                                more = tcpClient.recv(16)
                                print more

                                if more == "over":
                                        print "Start manage.py and exit"
                                        if not(os.path.exists(CurDir + "service.update")):
                                                subprocess.Popen(["sudo","-u","root","-p","root","cp",CurDir + "serviceSub.py",CurDir + "service.update"])
                                        exit()

                elif response == "settings":

                        print "Get size code"
                        size = tcpClient.recv(4).strip('\0')
                        print size
                        tcpClient.send(size)
                        
                        print "Get code"
                        code = tcpClient.recv(int(size)).strip('\0')
                        SetStrInFile(CurDir + "data/Settings.update",code)
                        tcpClient.send("0")
        
                        print "File operation"
                        subprocess.call(["sudo","-u","root","-p","root","mv",CurDir + "data/Settings.update",CurDir + "data/Settings"])
                        print "Settings update successfull!"
        
                        response = tcpClient.recv(16).strip('\0')
                        print "Action is: " + response
                        tcpClient.send("0")
        
                        if response == "run":
                                print "Start manage.py and exit"
                                subprocess.Popen(["sudo","-u","root","-p","root","python",CurDir + "manage.py"])
                                exit()
                
                break

        except Exception as error:
                print error
                pass
                sys.exc_clear()
                print "reconnect 3g"
                Connect3g()