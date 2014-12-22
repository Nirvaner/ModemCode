import time
import socket
import subprocess
import sys
import os

CurDir = "/home/pi/Python/"

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

def SetServiceServer(s):
        SetStrInFile(CurDir + "data/ServiceServer",s)

def GetServiceVersion():
        return GetStrFromFile(CurDir + "data/ServiceVersion")
def SetServiceVersion(s):
        SetStringInFile(CurDir + "data/ServiceVersion",s)

def GetManageVersion():
        return GetStrFromFile(CurDir + "data/ManageVersion")

def SetManageVersion(s):
        SetStrInFile(CurDir + "data/ManageVersion")
def GetSkdVersion():
        GetStrFromFile(CurDir + "data/SKDVersion")

Id = GetId()
serviceVersion = GetServiceVersion()
manageVersion = GetManageVersion()
skdVersion = GetSkdVersion()
serverAddress = GetServiceServer()
serverPort = 10101

print "Service started"
try:
        server = socket.socket()
        server.connect((serverAddress,serverPort))
        server.send("|".join([Id,serviceVersion,manageVersion,skdVersion,serverAddress]))

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
        print response
        server.send("0")

        #Обновляем модем, если надо, или запускаем manage.py

        except Exception:
                pass
                print "Connect to ServiceServer: failed"
                break
