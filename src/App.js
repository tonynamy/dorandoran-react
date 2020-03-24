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
import TextField from "@material-ui/core/TextField";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogContentText from "@material-ui/core/DialogContentText";
import Typography from "@material-ui/core/Typography";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Box from "@material-ui/core/Box";

import "moment/locale/ko";

import firebaseConfig from "./firebaseConfig.json";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

var db = firebase.firestore();

class App extends Component {

  unsubscribeChatSnapshotListener = null;

  constructor() {
    super();
    this.state = {
      messages: [],
      user: {},
      channels: [],
      isAuthenticated: false,
      addingChatRoom: false,
      selectedChannel: {},
      channelUsers: []
    };
  }

  async signIn() {
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({
      prompt: "select_account"
    });

    try {
      await firebase.auth().signInWithPopup(googleProvider);
    } catch (error) {
      console.error(error);
    }
  }

  async signOut() {
    await firebase.auth().signOut();
  }

  async handleAuthEvent(user) {
    if (user) {
      let result = db.collection("users").doc(user.uid).get();

      if (result.empty) {
        // 신규회원

        await db.collection("chatrooms").doc(user.uid).set({
          displayName: user.displayName,
          email: user.email,
          profileImage: user.photoURL
        });
      }

      this.setState({
        isAuthenticated: true,
        user: Object.assign({ id: user.uid }, user)
      });
      this.loadChatRooms();
    } else {
      this.setState({ isAuthenticated: false, user: {}, messages: [] });
    }
  }

  componentDidMount() {
    firebase.auth().onAuthStateChanged(user => this.handleAuthEvent(user));
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
    if(this.unsubscribeChatSnapshotListener!==null) {
      this.unsubscribeChatSnapshotListener();
      this.unsubscribeChatSnapshotListener = null;
    }
    this.loadMessages(chatroom_id);
  }

  async loadMessages(chatroom_id) {

    const loadMessageCallback = doc => {
      let id = chatroom_id;
      let docData = doc.data();
      let channelUsers = this.state.channelUsers;

      let messages = (docData.messages ? docData.messages : []).map(function (
        message,
        idx
      ) {

        let chatUser = channelUsers.find(user => user.id === message.uid);
        let notChatUser = channelUsers.find(user=>user.id !== message.uid);

        notChatUser = notChatUser ? notChatUser : {id:-1};

        let chatSeenIdx = docData.seen.hasOwnProperty(notChatUser.id) ? docData.seen[notChatUser.id] : -1;
        let chatSeen = idx*1 <= chatSeenIdx*1 ? true : false;

        return {
          id: idx,
          text: message.content,
          createdAt: new Date(message.createdAt.seconds * 1000),
          user: {
            id: chatUser ? chatUser.id : -1,
            name: chatUser ? chatUser.displayName : "알 수 없는 사용자",
            avatar: chatUser ? chatUser.profileImage : ""
          },
          sent: chatSeen,
          received: chatSeen,
        };
      });

      //읽음처리

      if( docData.messages && (!docData.seen || !docData.seen.hasOwnProperty(this.state.user.id) || ( docData.messages.length-1 !== docData.seen[this.state.user.id] ))) {

        const seenVal = { seen : {}};
        seenVal["seen"][this.state.user.id] = docData.messages.length-1

        doc.ref.set( seenVal, {merge: true});

      }

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

    this.unsubscribeChatSnapshotListener = db.collection("chatrooms").doc(chatroom_id).onSnapshot(loadMessageCallback);
  }

  toggleAddingChatRoom() {
    this.setState({ addingChatRoom: !this.state.addingChatRoom });
  }

  async handleAddChatting() {
    let email = this.state.addChatingEmailAddress;

    let usersRef = db.collection("users");
    let query = usersRef.where("email", "==", email);

    let result = await query.get();

    if (result.empty) {
      alert("사용자를 찾을 수 없습니다.");

      this.setState({ addingChatRoom: false, addChatingEmailAddress: "" });
    } else {
      let me = usersRef.doc(this.state.user.id);
      let friend = result.docs[0].ref;

      await db.collection("chatrooms").add({
        displayName: result.docs[0].data().displayName,
        users: [me, friend]
      });

      this.setState({ addingChatRoom: false, addChatingEmailAddress: "" });
    }
  }

  renderAddChatRoomPopup() {
    const handleClose = () => {
      this.toggleAddingChatRoom();
    };

    const handleChange = event => {
      this.setState({ addChatingEmailAddress: event.target.value });
    };

    return (
      <div>
        <Dialog
          open={this.state.addingChatRoom}
          onClose={handleClose}
          aria-labelledby="form-dialog-title"
        >
          <DialogTitle id="form-dialog-title">채팅 추가</DialogTitle>
          <DialogContent>
            <DialogContentText>
              채팅 상대의 이메일 주소를 입력해주세요.
            </DialogContentText>
            <TextField
              autoFocus
              margin="dense"
              id="name"
              label="이메일 주소"
              type="email"
              value={this.state.addChatingEmailAddress}
              onChange={handleChange}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} color="primary">
              취소
            </Button>
            <Button onClick={() => this.handleAddChatting()} color="primary">
              채팅 추가
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }

  renderAuthPopup() {
    return (
      <Dialog open={!this.state.isAuthenticated}>
        <DialogTitle id="simple-dialog-title">로그인/회원가입</DialogTitle>
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
              <ListItemText primary="GOOGLE로 로그인" />
            </ListItem>
          </List>
          <Box color="primary.main" mx={5} my={2}>
            구글 로그인 시 신규 회원은 자동으로 회원가입됩니다.
          </Box>
          <Box color="primary.main" mx={5} my={2}>
            로그인 시 사이트 개인정보처리방침에 동의함하는 것으로 간주됩니다.
          </Box>
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
    const mapChannelItems = channel => {
      const friend = channel.userModels.find(
        model => model.id !== this.state.user.id
      );

      return (
        <ListItem
          button
          key={channel.id}
          onClick={() => this.onChatRoomClicked(channel.id)}
        >
          <ListItemAvatar>
            <Avatar
              alt="아바타"
              src={friend ? friend.profileImage : ""}
            ></Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={friend ? friend.displayName : "알 수 없는 사용자"}
          />
        </ListItem>
      );
    };

    const channelItems = this.state.channels.map(mapChannelItems);

    return <List>{channelItems}</List>;
  }

  renderChannelsHeader() {
    return (
      <AppBar position="static" color="default">
        <Toolbar>
          <Typography variant="h6" color="inherit" style={{ flex: 1 }}>
            채팅방
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => this.toggleAddingChatRoom()}
          >
            채팅추가
          </Button>
        </Toolbar>
      </AppBar>
    );
  }
  renderChatHeader() {
    if (Object.keys(this.state.selectedChannel).length === 0) {
      return (
        <AppBar position="static" color="default">
          <Toolbar>
            <Typography variant="h6" color="inherit">
              채팅방을 선택해주세요.
            </Typography>
          </Toolbar>
        </AppBar>
      );
    } else {
      const friend = this.state.selectedChannel.userModels.find(
        model => model.id !== this.state.user.id
      );
      return (
        <AppBar position="static" color="default">
          <Toolbar>
            <Typography variant="h6" color="inherit">
              {friend ? friend.displayName : "알 수 없는 사용자"}
            </Typography>
          </Toolbar>
        </AppBar>
      );
    }
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
        {this.renderAuthPopup()}
        {this.renderAddChatRoomPopup()}
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
