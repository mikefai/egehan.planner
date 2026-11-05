// State — app-wide mutable data
let sb = null;
let currentUser = null;
let currentProfile = null;
let isAdmin = false;

let sessions = [];
let scores = [];
let projects = [];
let portSessions = [];
let goals = [];
let homework = [];
let notifications = [];
let students = [];
let hwAttachments = {};
let pendingAttachments = [];
let realtimeReady = false;
let loginRunning = false;
let errorLog = [];
let oneOnOne = [];
let oneOnOneMonth = new Date();
let scoreSeries = 'total';
let viewAsStudent = null;   // admin read-only preview of a student's view
