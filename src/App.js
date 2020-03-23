import React, { Component } from "react";
import ReactDOM from "react-dom";
import { GiftedChat } from "react-web-gifted-chat";
import firebase from "firebase";
import Button from "@material-ui/core/Button";
import Avatar from "@material-ui/core/Avatar";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemText from "@material-ui/core/ListItemText";
import DialogTitle from "@material-ui/core/DialogTitle";
import Dialog from "@material-ui/core/Dialog";
import Typography from "@material-ui/core/Typography";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";

import 'moment/locale/ko'

import firebaseConfig from "./firebaseConfig.json";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

var db = firebase.firestore();

const weekKorName=['일', '월', '화', '수', '목', '금', '토'];

class App extends Component {
  constructor() {
    super();
    this.state = {
      messages: [],
      user: {},
      channels: [],
      isAuthenticated: false,
      selectedChannel: {},
      channelUsers: []
    };
  }

  async signIn() {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    try {
      await firebase.auth().signInWithPopup(googleProvider);
    } catch (error) {
      console.error(error);
    }
  }

  signOut() {
    firebase.auth().signOut();
  }

  componentDidMount() {
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        this.setState({
          isAuthenticated: true,
          user: Object.assign({ id: user.uid }, user)
        });
        this.loadChatRooms();
      } else {
        this.setState({ isAuthenticated: false, user: {}, messages: [] });
      }
    });
  }

  loadChatRooms() {
    const chatRoomCallback = querySnapshot => {
      this.loadChatRoomInfo(querySnapshot);
    };

    const meRef = db.collection("users").doc(this.state.user.uid);

    db.collection("chatrooms")
      .where("users", "array-contains", meRef)
      .onSnapshot(chatRoomCallback);
  }

  async loadChatRoomInfo(querySnapshot) {
    if (querySnapshot.empty) return console.log("Do Not Exist In DB");

    let chatRooms = [];

    for (const doc of querySnapshot.docs) {
      let chatRoom = doc.data();

      chatRoom.id = doc.id;

      let userInfoPromises = [];

      chatRoom.users.forEach(user => userInfoPromises.push(user.get()));

      let userInfos = await Promise.all(userInfoPromises);

      chatRoom.userModels = userInfos.map(userInfo =>
        Object.assign({ id: userInfo.id }, userInfo.data())
      );

      chatRooms.push(chatRoom);
    }

    this.setState({ channels: chatRooms });
  }

  onChatRoomClicked(chatroom_id) {
    this.loadMessages(chatroom_id);
  }

  async loadMessages(chatroom_id) {
    const loadMessageCallback = doc => {
      let id = chatroom_id;
      let docData = doc.data();
      let channelUsers = this.state.channelUsers;

      let messages = docData.messages.map(function (message, idx) {
        let chatUser = channelUsers.find(user => user.id === message.uid);

        return {
          id: idx,
          text: message.content,
          createdAt: new Date(message.createdAt.seconds * 1000),
          user: {
            id: chatUser.id,
            name: chatUser.displayName,
            avatar: chatUser.profileImage
          }
        };
      });

      this.setState({
        selectedChannel: this.state.channels.find(channel => channel.id === id),
        messages: messages
      });
    };

    //load users first

    let userInfoPromises = [];

    this.state.channels
      .find(channel => channel.id === chatroom_id)
      .users.forEach(user => userInfoPromises.push(user.get()));

    let userInfos = await Promise.all(userInfoPromises);
    userInfos = userInfos.map(info =>
      Object.assign({ id: info.id }, info.data())
    );

    this.setState({ channelUsers: userInfos });

    db.collection("chatrooms").doc(chatroom_id).onSnapshot(loadMessageCallback);
  }

  renderPopup() {
    return (
      <Dialog open={!this.state.isAuthenticated}>
        <DialogTitle id="simple-dialog-title">로그인</DialogTitle>
        <div>
          <List>
            <ListItem button onClick={() => this.signIn()}>
              <ListItemAvatar>
                <Avatar style={{ backgroundColor: "#eee" }}>
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg"
                    height="30"
                    alt="G"
                  />
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary="구글 로그인" />
            </ListItem>
          </List>
        </div>
      </Dialog>
    );
  }

  onSend(messages) {
    for (const message of messages) {
      this.pushMessage(message);
    }
  }

  pushMessage(message) {
    return firebase
      .firestore()
      .collection("chatrooms")
      .doc(this.state.selectedChannel.id)
      .update({
        messages: firebase.firestore.FieldValue.arrayUnion({
          content: message.text,
          createdAt: new Date(),
          uid: this.state.user.id
        })
      });
  }

  renderSignOutButton() {
    if (this.state.isAuthenticated) {
      return <Button onClick={() => this.signOut()}>로그아웃</Button>;
    }
    return null;
  }

  renderChat() {
    if (!this.state.selectedChannel) return;

    return (
      <GiftedChat
        user={this.state.user}
        messages={this.state.messages.slice().reverse()}
        onSend={messages => this.onSend(messages)}
        placeholder="메시지를 입력해주세요."
        locale="ko"
        dateFormat="YYYY년 MM월 DD일 dddd"
      />
    );
  }

  renderChannels() {
    const channelItems = this.state.channels.map(channel => (
      <ListItem
        button
        key={channel.id}
        onClick={() => this.onChatRoomClicked(channel.id)}
      >
        <ListItemAvatar>
          <Avatar
            alt="아바타"
            src={
              channel.userModels.find(model => model.id !== this.state.user.id)
                .profileImage
            }
          ></Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            channel.userModels.find(model => model.id !== this.state.user.id)
              .displayName
          }
        />
      </ListItem>
    ));

    return <List>{channelItems}</List>;
  }

  renderChannelsHeader() {
    return (
      <AppBar position="static" color="default">
        <Toolbar>
          <Typography variant="h6" color="inherit">
            채팅방
          </Typography>
        </Toolbar>
      </AppBar>
    );
  }
  renderChatHeader() {
    
    if (Object.keys(this.state.selectedChannel).length===0)
      return (
        <AppBar position="static" color="default">
          <Toolbar>
            <Typography variant="h6" color="inherit">
              채팅방을 선택해주세요.
            </Typography>
          </Toolbar>
        </AppBar>
      );
    else
      return (
        <AppBar position="static" color="default">
          <Toolbar>
            <Typography variant="h6" color="inherit">
              {
                this.state.selectedChannel.userModels.find(
                  model => model.id !== this.state.user.id
                ).displayName
              }
            </Typography>
          </Toolbar>
        </AppBar>
      );
  }
  renderSettingsHeader() {
    return (
      <AppBar position="static" color="default">
        <Toolbar>
          <Typography variant="h6" color="inherit">
            설정
          </Typography>
        </Toolbar>
      </AppBar>
    );
  }

  render() {
    return (
      <div style={styles.container}>
        {this.renderPopup()}
        <div style={styles.channelList}>
          {this.renderChannelsHeader()}
          {this.renderChannels()}
        </div>
        <div style={styles.chat}>
          {this.renderChatHeader()}
          {this.renderChat()}
        </div>
        <div style={styles.settings}>
          {this.renderSettingsHeader()}
          {this.renderSignOutButton()}
        </div>
      </div>
    );
  }
}

const styles = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    height: "100vh"
  },
  channelList: {
    display: "flex",
    flex: 1,
    flexDirection: "column"
  },
  chat: {
    display: "flex",
    flex: 3,
    flexDirection: "column",
    borderWidth: "1px",
    borderColor: "#ccc",
    borderRightStyle: "solid",
    borderLeftStyle: "solid"
  },
  settings: {
    display: "flex",
    flex: 1,
    flexDirection: "column"
  }
};

export default App;
