import snap7
import Queue
import threading
import time
import datetime
import socket
import subprocess
import sys
import os
import struct

CurDir = "/devir/ModemCode/manage/"

def GetStrFromFile(path):
        f = open(path,"r")
        res = f.read().strip('\0')
        f.close()
        return res.strip('\n')

def SetStrInFile(path,s):
        f = open(path,"w")
        f.write(s)
        f.close()        

modemNumber = int(GetStrFromFile(CurDir + "set").split('|')[0])
serverPort = 10102

serverAddress = "0.0.0.0"
ipAddress = "0.0.0.0"
plcAddress = "0.0.0.0"
db = 0
size = 0
lightRead = 0
hardRead = 0
bytesToCheck = {0,1,2};
skdState = 0
skdDb = 0
skdStartPos = 0
skdBitPos = 0
isSet = False

wsDb = 0
wsStartPos = 0
wsBitPos = 0
wsData = 0

q = Queue.Queue()
firstArrayFromPLC = bytearray(size)
secondArrayForCheck = bytearray(size)

def SetSettings(s):
        print "SetSettings: " + s
        setArr = s.split('|')
        global serverAddress
        global ipAddress
        global plcAddress
        global db
        global size
        global lightRead
        global hardRead
        global bytesToCheck
        global skdDb
        global skdStartPos
        global skdBitPos
        serverAddress = setArr[0]
        ipAddress = setArr[1]
        plcAddress = setArr[2]
        db = int(setArr[3])
        size = int(setArr[4])
        lightRead = int(setArr[5]) * 1000
        hardRead = float(setArr[6]) / 1000
        keyArr = setArr[7].split(',')
        while len(bytesToCheck) > 0:
                bytesToCheck.pop()
        for it in keyArr:
                bytesToCheck.add(int(it))
        skd = setArr[8].split(',')
        skdDb = int(skd[0])
        skdStartPos = int(skd[1])
        skdBitPos = int(skd[2])
        global isSet
        global firstArrayFromPLC
        global secondArrayForCheck
        firstArrayFromPLC = bytearray(size)
        secondArrayForCheck = bytearray(size)
        isSet = True

def SetSkdState(state):
        global skdState
        if state[0] == "0":
                skdState = skdState & 6
        else:
                skdState = skdState | 1
        if state[1] == "0":
                skdState = skdState & 5
        else:
                skdState = skdState | 2
        if state[2] == "0":
                skdState = skdState & 3
        else:
                skdState = skdState | 4
        print "New skdState is " + str(skdState)
        if ((state[0] == "0") and (state[1] == "1")) or (state[2] == "1"):
                WriteToController(skdDb, skdStartPos, skdBitPos, 1, 1, True)
        else:
                WriteToController(skdDb, skdStartPos, skdBitPos, int("11111110", 2), 1, False)   

def WriteToController(db, start, bit, data, size, command):
        try:
                global plcAddress
                plcClient = snap7.client.Client()
                if not(plcClient.get_connected()):
                                plcClient.connect(plcAddress, 0, 0)
                print "WriteToSiements"
                if not(plcClient.get_connected()):
                        plcClient.connect(plcAddress, 0, 0)
                if bit > -1:
                        print "DBRead params " + str(db) + str(start)
                        value = int(struct.unpack("B", str(plcClient.db_read(db, start, 1)))[0])
                        print "Value of DB " + str(value)
                        print "Command " + str(command)
                        print "Data " + str(data)
                        if command:
                                value = value | data
                        else:
                                value = value & data
                        print "Value before command " + str(value)
                else:
                        value = data
                dvalue = bytearray({0,})
                if size == 1:
                        dvalue = bytearray(struct.pack("B", value))
                elif size == 2:
                        dvalue = bytearray(struct.pack("H", value))
                elif size == 4:
                        dvalue = bytearray(struct.pack("L", value))
                plcClient.db_write(db, start, dvalue)
                return True
                print "Write to siements succesfull"
                plcClient.disconnect()
        except Exception as error:
                pass
                sys.exc_clear()
                print "Siements>WriteToController: " + str(error)
                plcClient.disconnect()
                return False

def EventsReceiver(skdState):
        server = socket.socket()
        server.bind(("", 10002))
        server.listen(3)
        while True:
                try:
                        skdSock, addr = server.accept()
                        command = skdSock.recv(512).strip('\0')
                        skdSock.close()
                        if command[0] == "0":
                                SetSettings(command[1:])
                        elif command[0] == "1":
                                SetSkdState(command[1:])
                        elif command[0] == "2":
                                global writeToSiementsStartPosition
                                global writeToSiementsData
                                global isNeedWriteToSiements
                                writeArr = command[2:].split("|")
                                writeToSiementsStartPosition = writeArr[0]
                                writeToSiementsData = writeArr[1]
                                isNeedWriteToSiements = True

                except Exception as error:
                        pass
                        sys.exc_clear()
                        print "Siements>EventsReceiver: " + str(error)

def SendBufferToServer(buf):
        try:
                tcpClient = socket.socket()
                tcpClient.connect((serverAddress, serverPort))
                tcpClient.send(buf)
                tcpClient.close()
                return True
        except Exception as error:
                print "Siements>SendBufferToServer: " + str(error)
                pass
                sys.exc_clear()
        return False

def ReadFromQueue(q):
        while True:
                if q.qsize()>0:
                        obj = q.get()
                        if not(SendBufferToServer(obj)):
                                q.put(obj)
                                time.sleep(1)
                        time.sleep(0.01)

def CheckBuffer(firstArrayFromPLC, secondArrayForCheck, bytesToCheck):
        for item in bytesToCheck:
                if(firstArrayFromPLC[int(item)] != secondArrayForCheck[int(item)]):
                        return True
        return False

def ReadFromPLC(q,firstArrayFromPLC,secondArrayForCheck,bytesToCheck):
        plcClient = snap7.client.Client()
        currentMillis=0
        lastMillis=0
        readPLCErrors=0
        while True:
                try:
                        global isNeedWriteToSiements
                        if not(plcClient.get_connected()):
                                plcClient.connect(plcAddress, 0, 0)
                        firstArrayFromPLC = bytearray(struct.pack("h",modemNumber))
                        firstArrayFromPLC += bytearray(struct.pack("b",skdState))
                        firstArrayFromPLC += plcClient.db_read(db, 0, size)
                        readPLCErrors = 0
                        currentMillis = int(round(time.time()*1000))
                        if ((CheckBuffer(firstArrayFromPLC, secondArrayForCheck, bytesToCheck)) | (currentMillis-lastMillis>lightRead)):
                                lastMillis = currentMillis
                                secondArrayForCheck = firstArrayFromPLC
                                date = datetime.datetime.now()
                                firstArrayFromPLC += bytearray(struct.pack("h",int(date.year)))
                                firstArrayFromPLC += bytearray(struct.pack("b",int(date.month)))
                                firstArrayFromPLC += bytearray(struct.pack("b",int(date.day)))
                                firstArrayFromPLC += bytearray(struct.pack("b",int(date.hour)))
                                firstArrayFromPLC += bytearray(struct.pack("b",int(date.minute)))
                                firstArrayFromPLC += bytearray(struct.pack("b",int(date.second)))
                                firstArrayFromPLC += bytearray(struct.pack("i",int(date.microsecond)))
                                qs = q.qsize()
                                if qs > 1000:
                                        c = q.get()
                                q.put(firstArrayFromPLC)
                                time.sleep(hardRead)
                except Exception as error:
                        pass
                        sys.exc_clear()
                        print "Siements>ReadFromPLC: " + str(error)
                        readPLCErrors=readPLCErrors+1
                        if readPLCErrors>20:
                                #Suda nado chto nit' dopisat'
                                readPLCErrors = 0
                        time.sleep(3)
                time.sleep(0.01)

print 'Manage started'

tEventsReceiver = threading.Thread(target=EventsReceiver, args = (skdState,))
tEventsReceiver.daemon = True
tEventsReceiver.start()
print "tEventsReceiver is started"

while True:
        if not(isSet):
                time.sleep(0)
        else:
                break

tReadFromPLC = threading.Thread(target=ReadFromPLC, args = (q,firstArrayFromPLC,secondArrayForCheck,bytesToCheck))
tReadFromPLC.daemon = True
tReadFromPLC.start()
print "tReadFromPLC is started"

tReadFromQueue = threading.Thread(target=ReadFromQueue, args = (q,))
tReadFromQueue.daemon = True
tReadFromQueue.start()
print "tReadFromQueue is started"

tReadFromPLC.join()
tReadFromQueue.join()
tEventsReceiver.join()