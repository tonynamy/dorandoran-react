import React from 'react';
import logo from './logo.svg';
import firebase from 'firebase';

import './App.css';
import firebaseConfig from './firebaseConfig.json';

firebase.initializeApp(firebaseConfig);

export default firebase;
