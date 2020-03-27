import React, { Component } from "react";
import ReactDOM from "react-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { GiftedChat, MessageImage, Send } from "react-web-gifted-chat";
import firebase from "firebase";
import Button from "@material-ui/core/Button";
import Avatar from "@material-ui/core/Avatar";
import List from "@material-ui/core/List";
import Divider from "@material-ui/core/Divider";
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
import Fab from "@material-ui/core/Fab";
import Paper from "@material-ui/core/Paper";
import EmojiEmotionsIcon from "@material-ui/icons/EmojiEmotions";
import CircularProgress from "@material-ui/core/CircularProgress";
import Popper from "@material-ui/core/Popper";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import GridList from "@material-ui/core/GridList";
import GridListTile from "@material-ui/core/GridListTile";
import IconButton from "@material-ui/core/IconButton";
import MenuIcon from "@material-ui/icons/Menu";
import AccountCircle from "@material-ui/icons/AccountCircle";
import Image from "react-image-resizer";
import MenuItem from "@material-ui/core/MenuItem";
import Menu from "@material-ui/core/Menu";
import Drawer from "@material-ui/core/Drawer";
import MoreIcon from "@material-ui/icons/MoreVert";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import "moment/locale/ko";

import firebaseConfig from "./firebaseConfig.json";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <Paper style={{ padding: 0 }}>
      {value === index && <Box p={1}>{children}</Box>}
    </Paper>
  );
}

var db = firebase.firestore();
var storage = firebase.storage();

class App extends Component {
  unsubscribeChatSnapshotListener = null;

  constructor() {
    super();
    this.emoticonShowBtnRef = React.createRef();
    this.menuAnchorEl = React.createRef();
    this.giftedChatRef = React.createRef();
    this.state = {
      messages: [],
      user: {},
      channels: [],
      isAuthenticated: false,
      addingChatRoom: false,
      selectedChannel: {},
      channelUsers: [],
      isLeaving: false,
      loadingMessages: false,
      isShowingEmoticons: false,
      emoticonTabNum: 0,
      emoticonPacks: null,
      isDrawerOpen: false,
      isMenuOpen: false
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
    this.setState({
      messages: [],
      user: {},
      channels: [],
      isAuthenticated: false,
      addingChatRoom: false,
      selectedChannel: {},
      channelUsers: [],
      isLeaving: false,
      loadingMessages: false,
      isShowingEmoticons: false,
      emoticonTabNum: 0,
      emoticonPacks: null,
      isDrawerOpen: false,
      isMenuOpen: false
    });
  }

  async handleAuthEvent(user) {
    if (user) {
      let result = await db.collection("users").doc(user.uid).get();

      if (!result.exists) {
        // 신규회원

        await db.collection("users").doc(user.uid).set({
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

    chatRooms.sort(function(a, b) {
      if ( ( a.messages && a.messages.length > 0 && a.messages[a.messages.length-1].hasOwnProperty("createdAt") ? a.messages[a.messages.length-1].createdAt.seconds : a.createdAt.seconds ) <
           ( b.messages && b.messages.length > 0 && b.messages[b.messages.length-1].hasOwnProperty("createdAt") ? b.messages[b.messages.length-1].createdAt.seconds : b.createdAt.seconds ) ) {
        return -1;
      }
      if (( a.messages && a.messages.length > 0 && a.messages[a.messages.length-1].hasOwnProperty("createdAt") ? a.messages[a.messages.length-1].createdAt.seconds : a.createdAt.seconds ) >
           ( b.messages && b.messages.length > 0 && b.messages[b.messages.length-1].hasOwnProperty("createdAt") ? b.messages[b.messages.length-1].createdAt.seconds : b.createdAt.seconds ) ) {
        return 1;
      }

      // a must be equal to b
      return 0;
    });

    this.setState({ channels: chatRooms.reverse() });
  }

  onChatRoomClicked(chatroom_id) {
    this.setState({ isDrawerOpen: false });
    if (this.unsubscribeChatSnapshotListener !== null) {
      this.unsubscribeChatSnapshotListener();
      this.unsubscribeChatSnapshotListener = null;
    }
    this.loadMessages(chatroom_id);
  }

  async loadMessages(chatroom_id) {
    this.setState({
      selectedChannel: this.state.channels.find(
        channel => channel.id === chatroom_id
      ),
      loadingMessages: true
    });

    await this.loadEmoticons();

    const emoticonPacks = this.state.emoticonPacks;

    const loadMessageCallback = doc => {
      let id = chatroom_id;
      let docData = doc.data();
      let channelUsers = this.state.channelUsers;

      let messages = (docData.messages ? docData.messages : []).map(function (
        message,
        idx
      ) {
        let chatUser = channelUsers.find(user => user.id === message.uid);
        let notChatUser = channelUsers.find(user => user.id !== message.uid);

        notChatUser = notChatUser ? notChatUser : { id: -1 };

        let chatSeenIdx =
          docData.seen && docData.seen.hasOwnProperty(notChatUser.id)
            ? docData.seen[notChatUser.id]
            : -1;
        let chatSeen = idx * 1 <= chatSeenIdx * 1 ? true : false;

        let contentObj = {};

        if (!message.emoticon || Object.values(message.emoticon) === 0) {
          contentObj = { text: message.content };
        } else {
          let emoticon = message.emoticon;
          let emoticonPackId = emoticon.emoticonPackId
            ? emoticon.emoticonPackId
            : "";
          let emoticonDisplayName = emoticon.displayName
            ? emoticon.displayName
            : "";

          let emoticonPack = emoticonPacks.find(
            emoticonPack => emoticonPack.id === emoticon.emoticonPackId
          );

          if (!emoticonPack || !emoticonPack.emoticons) {
            contentObj = { text: message.content };
          } else {
            let matchEmoticon = emoticonPack.emoticons.find(
              emObj => emObj.displayName === emoticonDisplayName
            );

            if (!matchEmoticon || !matchEmoticon.url) {
              contentObj = { text: message.content };
            } else {
              contentObj = { image: matchEmoticon.url };
            }
          }
        }

        return Object.assign(contentObj, {
          id: idx,

          createdAt: new Date(message.createdAt.seconds * 1000),
          user: {
            id: chatUser ? chatUser.id : -1,
            name: chatUser ? chatUser.displayName : "알 수 없는 사용자",
            avatar: chatUser ? chatUser.profileImage : ""
          },
          sent: chatSeen,
          received: chatSeen
        });
      });

      //읽음처리

      if (
        docData.messages &&
        (!docData.seen ||
          !docData.seen.hasOwnProperty(this.state.user.id) ||
          docData.messages.length - 1 !== docData.seen[this.state.user.id])
      ) {
        const seenVal = { seen: {} };
        seenVal["seen"][this.state.user.id] = docData.messages.length - 1;

        doc.ref.set(seenVal, { merge: true });
      }

      this.setState({
        selectedChannel: this.state.channels.find(channel => channel.id === id),
        messages: messages,
        loadingMessages: false
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

    this.unsubscribeChatSnapshotListener = db
      .collection("chatrooms")
      .doc(chatroom_id)
      .onSnapshot(loadMessageCallback);
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
            로그인 시 사이트 개인정보처리방침에 동의하는 것으로 간주됩니다.
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

  sendEmoticon(emoticonPack, emoticon) {
    return firebase
      .firestore()
      .collection("chatrooms")
      .doc(this.state.selectedChannel.id)
      .update({
        messages: firebase.firestore.FieldValue.arrayUnion({
          createdAt: new Date(),
          uid: this.state.user.id,
          emoticon: {
            emoticonPackId: emoticonPack.id,
            displayName: emoticon.displayName
          }
        })
      });
  }

  async leaveChatRoom() {
    if (Object.keys(this.state.selectedChannel).length === 0) {
      this.setState({ isLeaving: false });
      return;
    }

    await db
      .collection("chatrooms")
      .doc(this.state.selectedChannel.id)
      .update({
        users: firebase.firestore.FieldValue.arrayRemove(
          db.collection("users").doc(this.state.user.id)
        )
      });
    this.setState({ selectedChannel: {}, isLeaving: false });
  }

  async loadEmoticons() {
    this.setState({ emoticonPacks: null });
    let result = await db.collection("emoticons").get();

    if (result.empty) return this.setState({ emoticonPacks: [] });

    let emoticonPacks = [];
    let emoticonUrlPromises = [];

    let emoticonPackMap = [];
    let emoticonObjectMap = [];

    for (const doc of result.docs) {
      let emoticonPackId = doc.id;
      let emoticonPack = doc.data();

      let emoticonStorageRefs = await storage
        .ref("emoticons")
        .child(emoticonPackId)
        .listAll();

      emoticonStorageRefs.items.forEach(ref => {
        emoticonUrlPromises.push(ref.getDownloadURL());

        emoticonPackMap.push(emoticonPackId);
        emoticonObjectMap.push({ displayName: ref.name });
      });

      emoticonPacks.push(
        Object.assign({ id: emoticonPackId, emoticons: [] }, emoticonPack)
      );
    }

    let emoticonUrls = await Promise.all(emoticonUrlPromises);

    // Map emoticonUrls to emoticonPack
    emoticonUrls.forEach((emoticonUrl, idx) => {
      let emoticonPack = emoticonPacks.find(
        pack => pack.id === emoticonPackMap[idx]
      );

      if (!emoticonPack) return false;

      emoticonPack.emoticons.push(
        Object.assign({ url: emoticonUrl }, emoticonObjectMap[idx])
      );
    });

    this.setState({ emoticonPacks: emoticonPacks });
  }

  renderChat() {
    if (Object.keys(this.state.selectedChannel).length === 0) return;

    const open = Boolean(this.state.isShowingEmoticons);
    const id = open && this.emoticonShowBtnRef ? "emoticon-popper" : undefined;

    const sendCallback = messages => {
      this.onSend(messages);
    };

    const toggleEmoticonOpen = () => {
      this.setState({ isShowingEmoticons: !this.state.isShowingEmoticons });
    };

    const handleClose = () => {
      toggleEmoticonOpen();
    };

    const handleEmotcionTabChange = (event, newValue) => {
      this.setState({ emoticonTabNum: newValue });
    };

    const emoticonSize = 100;
    const emoticonsPerRow = 3;

    const sendEmoticonCallback = (emoticonPack, emoticon) => {
      this.sendEmoticon(emoticonPack, emoticon);
      toggleEmoticonOpen();
    };

    const renderSend = props => {
      return (
        <div style={{ display: "inline-flex" }}>
          {!this.state.emoticonPacks ? (
            <Button>
              <CircularProgress size={24} />
            </Button>
          ) : this.state.emoticonPacks.length === 0 ? (
            <div></div>
          ) : (
            <Button
              aria-describedby={id}
              alignItems="center"
              justify="center"
              onClick={toggleEmoticonOpen}
              ref={this.emoticonShowBtnRef}
            >
              <EmojiEmotionsIcon />
            </Button>
          )}
          {this.state.emoticonPacks && (
            <Popper
              id={id}
              open={open}
              anchorEl={this.emoticonShowBtnRef.current}
              onClose={handleClose}
              placement="top"
              transition
            >
              <AppBar position="static">
                <Tabs
                  value={this.state.emoticonTabNum}
                  onChange={handleEmotcionTabChange}
                  aria-label="emoticons"
                >
                  {this.state.emoticonPacks.map((emoticonPack, idx) => (
                    <Tab label={emoticonPack.displayName} />
                  ))}
                </Tabs>
              </AppBar>

              {this.state.emoticonPacks.map((emoticonPack, idx) => (
                <TabPanel
                  value={this.state.emoticonTabNum}
                  index={idx}
                  style={{ padding: 0 }}
                >
                  <div className={styles.root}>
                    <GridList
                      cellHeight={160}
                      className={styles.gridList}
                      cols={emoticonsPerRow}
                      style={{
                        width: emoticonSize * emoticonsPerRow,
                        height: emoticonSize * emoticonsPerRow,
                        padding: 0
                      }}
                    >
                      {emoticonPack.emoticons.map((emoticon, eIdx) => (
                        <GridListTile
                          key={emoticonPack.id + "/" + emoticon.displayName}
                          cols={1}
                          rows={1}
                          style={{ width: emoticonSize, height: emoticonSize }}
                          onClick={() => {
                            sendEmoticonCallback(emoticonPack, emoticon);
                          }}
                        >
                          <Image
                            src={emoticon.url}
                            height={emoticonSize}
                            width={emoticonSize}
                          />
                        </GridListTile>
                      ))}
                    </GridList>
                  </div>
                </TabPanel>
              ))}
            </Popper>
          )}

          <Send {...props}>
            <Button variant="contained" color="primary">
              전송
            </Button>
          </Send>
        </div>
      );
    };

    const messageImageRenderer = props => {
      return (
        <MessageImage
          {...props}
          imageStyle={{
            height: 150,
            width: 150
          }}
        />
      );
    };

    return (
      <GiftedChat
        ref={this.giftedChatRef}
        user={this.state.user}
        messages={this.state.messages.slice().reverse()}
        onSend={sendCallback}
        placeholder="메시지를 입력해주세요."
        renderSend={renderSend}
        renderMessageImage={messageImageRenderer}
        scrollToBottom={true}
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

      const unreadMessageCount =
        (channel.messages ? channel.messages.length : 0) -
        (channel.seen && channel.seen.hasOwnProperty(this.state.user.id)
          ? channel.seen[this.state.user.id]
          : -1) -
        1;

      const lastMessage =
        channel.messages && channel.messages.length > 0
          ? channel.messages[channel.messages.length - 1].emoticon &&
            Object.values(
              channel.messages[channel.messages.length - 1].emoticon
            ) !== 0
            ? "(이모티콘)"
            : channel.messages[channel.messages.length - 1].content
            ? channel.messages[channel.messages.length - 1].content
            : ""
          : "";

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
            style={styles.chatRoomText}
            primary={friend ? friend.displayName : "알 수 없는 사용자"}
            secondary={lastMessage}
          />

          {unreadMessageCount > 0 && (
            <Fab aria-label="new message" size="small" color="secondary">
              {unreadMessageCount}
            </Fab>
          )}
        </ListItem>
      );
    };

    const channelItems = this.state.channels.map(mapChannelItems);

    const addChannelItem = (
      <ListItem button key={-1} onClick={() => this.toggleAddingChatRoom()}>
        <ListItemText
          style={styles.chatRoomText}
          primary={"채팅추가"}
          secondary={"이메일로 상대를 찾습니다."}
        />
      </ListItem>
    );

    return (
      <List>
        {addChannelItem}
        <Divider />
        {channelItems}
      </List>
    );
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
            {this.state.loadingMessages && <CircularProgress />}
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

  renderToolbar() {
    const toggleDrawer = () => {
      this.setState({ isDrawerOpen: !this.state.isDrawerOpen });
    };
    const drawerOnCloseCallback = event => {
      if (!event) return;
      if (
        event.type === "keydown" &&
        (event.key === "Tab" || event.key === "Shift")
      ) {
        return;
      }
      toggleDrawer();
    };

    let chatRoomName = "";

    if (Object.keys(this.state.selectedChannel).length === 0) {
      chatRoomName = "채팅방을 선택해주세요.";
    } else {
      const friend = this.state.selectedChannel.userModels.find(
        model => model.id !== this.state.user.id
      );
      chatRoomName = friend ? friend.displayName : "알 수 없는 사용자";
    }

    return (
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={toggleDrawer}
        >
          <MenuIcon />
        </IconButton>
        <Drawer
          anchor={"left"}
          open={this.state.isDrawerOpen}
          onClose={drawerOnCloseCallback}
        >
          {this.renderChannels()}
        </Drawer>
        <div style={{ flex: 1, display: "inline-flex" }}>
          <Typography variant="h6">{chatRoomName}</Typography>
          {this.state.loadingMessages && (
            <CircularProgress size={24} color="secondary" />
          )}
        </div>
        {this.renderMenu()}
      </Toolbar>
    );
  }

  renderMenu() {
    let menuItemJSX = [];

    const handleMenu = event => {
      this.menuAnchorEl = event.currentTarget;
      toggleMenu();
    };

    const toggleMenu = () => {
      this.setState({ isMenuOpen: !this.state.isDrawerOpen });
    };

    const menuOnCloseCallback = event => {
      this.setState({ isMenuOpen: false });
      this.menuAnchorEl = null;
    };

    if (Object.keys(this.state.selectedChannel).length !== 0) {
      const handleLeave = () => {
        this.leaveChatRoom();
      };

      const leaveDialog = (
        <div>
          <Dialog
            open={this.state.isLeaving}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <DialogTitle id="alert-dialog-title">
              {"채팅방을 나가시겠습니까?"}
            </DialogTitle>
            <DialogContent>
              <DialogContentText id="alert-dialog-description">
                채팅방에서 나가면 다시 입장할 수 없습니다. (새 채팅을 시작하는
                것은 가능합니다.)
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => this.setState({ isLeaving: false })}
                color="primary"
              >
                취소
              </Button>
              <Button onClick={handleLeave} color="primary" autoFocus>
                나가기
              </Button>
            </DialogActions>
          </Dialog>
        </div>
      );

      menuItemJSX.push(
        <MenuItem onClick={() => this.setState({ isLeaving: true })}>
          채팅방 나가기
          {leaveDialog}
        </MenuItem>
      );
    }

    if (this.state.isAuthenticated) {
      menuItemJSX.push(
        <MenuItem onClick={() => this.signOut()}>로그아웃</MenuItem>
      );
    }

    return (
      <div>
        <IconButton
          edge="end"
          aria-label="display more actions"
          aria-controls="menu-appbar"
          aria-haspopup="true"
          color="inherit"
          onClick={handleMenu}
        >
          <MoreIcon />
        </IconButton>
        <Menu
          id="menu-appbar"
          anchorEl={this.menuAnchorEl}
          anchorOrigin={{
            vertical: "top",
            horizontal: "right"
          }}
          keepMounted
          transformOrigin={{
            vertical: "top",
            horizontal: "right"
          }}
          open={this.state.isMenuOpen}
          onClose={menuOnCloseCallback}
        >
          {menuItemJSX}
        </Menu>
      </div>
    );
  }

  render() {
    return (
      <div style={styles.container}>
        <AppBar position="static">{this.renderToolbar()}</AppBar>
        {this.renderAuthPopup()}
        {this.renderAddChatRoomPopup()}
        {this.renderChat()}
      </div>
    );
  }
}
const styles = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
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
  },
  chatRoomText: {
    marginLeft: 10
  },
  image: {
    width: 150,
    height: 100,
    borderRadius: 13,
    margin: 3,
    resizeMode: "cover"
  },
  menuButton: {
    marginRight: 2
  },
  title: {
    flexGrow: 1
  }
};

export default App;
