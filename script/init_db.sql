-- CREATE DATABASE HROnboardingDB

USE HROnboardingDB
GO

-- Drop existing tables if they exist
DROP TABLE IF EXISTS UserTraining
DROP TABLE IF EXISTS Trainings
DROP TABLE IF EXISTS Documents
DROP TABLE IF EXISTS UserChecklist
DROP TABLE IF EXISTS ChecklistItems
DROP TABLE IF EXISTS UserEquipment
DROP TABLE IF EXISTS Equipment
DROP TABLE IF EXISTS Announcements
DROP TABLE IF EXISTS FAQs
DROP TABLE IF EXISTS Users

-- users table
CREATE TABLE Users (
  UserId INT IDENTITY(1,1) PRIMARY KEY,
  Name NVARCHAR(120) NOT NULL,
  Email NVARCHAR(200) NOT NULL UNIQUE,
  PasswordHash NVARCHAR(200) NOT NULL,
  Role NVARCHAR(20) NOT NULL CHECK (Role IN ('HR','EMPLOYEE')),
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
)

-- checklist items table
CREATE TABLE ChecklistItems (
  ItemId INT IDENTITY(1,1) PRIMARY KEY,
  Title NVARCHAR(200) NOT NULL,
  Stage NVARCHAR(20) NOT NULL CHECK (Stage IN ('DAY1','WEEK1','MONTH1')),
  Description NVARCHAR(500) NULL,
  IsActive BIT NOT NULL DEFAULT 1
)

-- user checklist table
CREATE TABLE UserChecklist (
  UserId INT NOT NULL,
  ItemId INT NOT NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (Status IN ('PENDING','DONE')),
  UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  PRIMARY KEY (UserId, ItemId),
  FOREIGN KEY (UserId) REFERENCES Users(UserId),
  FOREIGN KEY (ItemId) REFERENCES ChecklistItems(ItemId)
)

-- document table
CREATE TABLE Documents (
  DocId INT IDENTITY(1,1) PRIMARY KEY,
  UserId INT NOT NULL,
  DocType NVARCHAR(50) NOT NULL,
  FileUrl NVARCHAR(300) NOT NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (Status IN ('PENDING','APPROVED','REJECTED')),
  HRComment NVARCHAR(300) NULL,
  UploadedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FOREIGN KEY (UserId) REFERENCES Users(UserId)
)

-- trainings table
CREATE TABLE Trainings (
  TrainingId INT IDENTITY(1,1) PRIMARY KEY,
  Title NVARCHAR(200) NOT NULL,
  StartsAt DATETIME2 NOT NULL,
  Location NVARCHAR(200) NULL,
  Notes NVARCHAR(500) NULL
)

-- user training table
CREATE TABLE UserTraining (
  UserId INT NOT NULL,
  TrainingId INT NOT NULL,
  Attendance NVARCHAR(20) NOT NULL DEFAULT 'UPCOMING' CHECK (Attendance IN ('UPCOMING','ATTENDED')),
  PRIMARY KEY (UserId, TrainingId),
  FOREIGN KEY (UserId) REFERENCES Users(UserId),
  FOREIGN KEY (TrainingId) REFERENCES Trainings(TrainingId)
)

-- equipment table
CREATE TABLE Equipment (
  EquipmentId INT IDENTITY(1,1) PRIMARY KEY,
  ItemName NVARCHAR(120) NOT NULL,
  SerialNumber NVARCHAR(120) NULL,
  Category NVARCHAR(50) NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
)

-- user equipment table
CREATE TABLE UserEquipment (
  AssignmentId INT IDENTITY(1,1) PRIMARY KEY,
  UserId INT NOT NULL,
  EquipmentId INT NOT NULL,
  AssignedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  DueBackAt DATETIME2 NULL,
  Notes NVARCHAR(250) NULL,
  EmployeeAck BIT NOT NULL DEFAULT 0,
  ReturnedAt DATETIME2 NULL,

  CONSTRAINT FK_UserEquipment_User FOREIGN KEY (UserId) REFERENCES Users(UserId),
  CONSTRAINT FK_UserEquipment_Equipment FOREIGN KEY (EquipmentId) REFERENCES Equipment(EquipmentId)
)

-- announcements table
CREATE TABLE Announcements (
  AnnouncementId INT IDENTITY(1,1) PRIMARY KEY,
  Title NVARCHAR(120) NOT NULL,
  Body NVARCHAR(MAX) NOT NULL,
  Audience NVARCHAR(20) NOT NULL DEFAULT 'ALL',
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CreatedByUserId INT NULL,
  CONSTRAINT FK_Announcements_User FOREIGN KEY (CreatedByUserId) REFERENCES Users(UserId)
)

-- faqs table
CREATE TABLE FAQs (
  FaqId INT IDENTITY(1,1) PRIMARY KEY,
  Question NVARCHAR(200) NOT NULL,
  Answer NVARCHAR(MAX) NOT NULL,
  Category NVARCHAR(80) NULL, -- e.g. Leave, Payroll, IT
  IsActive BIT NOT NULL DEFAULT 1,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
)

-- insert sample data
INSERT INTO ChecklistItems (Title, Stage, Description) VALUES
('Read company policies', 'DAY1', 'Review handbook + code of conduct'),
('Attend safety briefing', 'DAY1', '10:00 AM session'),
('Sign employment contract', 'WEEK1', 'Upload signed contract'),
('Collect laptop & access card', 'WEEK1', 'Collect from IT helpdesk'),
('Complete probation check-in', 'MONTH1', 'Meet with manager')

INSERT INTO Trainings (Title, StartsAt, Location, Notes) VALUES
('Welcome + Orientation', DATEADD(day, 1, SYSDATETIME()), 'Room 3-02', 'Bring notebook'),
('Security & Compliance', DATEADD(day, 2, SYSDATETIME()), 'Zoom', 'Join link will be posted')

INSERT INTO Equipment (ItemName, SerialNumber, Category) VALUES
('Laptop - Dell Latitude', 'DL-100233', 'Laptop'),
('Access Card', 'AC-99312', 'Access'),
('Headset', 'HS-22001', 'Accessories')

INSERT INTO FAQs (Question, Answer, Category) VALUES
('Where do I collect my access card?', 'Collect from HR on Day 1, 9am-11am.', 'Access'),
('Who do I contact for IT help?', 'Email IT Helpdesk or raise a ticket in the portal.', 'IT')

INSERT INTO Announcements (Title, Body, Audience) VALUES
('Welcome onboard!', 'Please complete your checklist and upload documents by end of Week 1.', 'ALL')

SELECT * FROM Users
SELECT * FROM ChecklistItems
SELECT * FROM UserChecklist
SELECT * FROM Documents
SELECT * FROM Trainings
SELECT * FROM UserTraining
SELECT * FROM Equipment
SELECT * FROM UserEquipment
SELECT * FROM Announcements
SELECT * FROM FAQs