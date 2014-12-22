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

                server = socket.socket()
                server.connect((serverAddress,serverPort))
                server.send("|".join([Id, version, serverAddress]))

                print "Get settings"
                print "Get size code"
                size = server.recv(4).strip('\0')
                print size
                server.send(size)
                
                print "Get code"
                code = server.recv(int(size)).strip('\0')
                SetStrInFile(CurDir + "data/Settings.update",code)
                server.send("0")

                print "Rename update files to executeble files"
                subprocess.call(["sudo","-u","root","-p","root","mv","data/Settings.update","data/Settings"])
                print "Settings update successfull!"

                response = server.recv(16).strip('\0')
                print "Action " + response
                server.send("0")

                if response == "run":
                        subprocess.popen(["sudo","-u","root","-p","root","python","/devir/ModemCode/Python/manage.py"])
                        exit()
                elif response == "update":
                        pathUpdate = "/devir/ModemCode/"
                        while True:
                                path = server.recv(128).strip('\0')
                                server.send("0")
                                print "path" + path

                                size = server.recv(4)
                                server.send(size)
                                print size

                                code = server.recv(int(size))
                                SetStrInFile(pathUpdate + path, code)
                                server.send("0")
                                print "File updated"

                                more = server.recv(16)
                                print more

                                if more == "over": 
                                        break
                break

        except Exception:
                pass
                print "Connect to ServiceServer is failed!"
                print "reconnect 3g"
                Connect3g()