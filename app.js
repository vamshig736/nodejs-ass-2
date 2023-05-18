const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

//register API
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUser = `SELECT * FROM user WHERE username='${username}'`;
  const dbUser = await db.get(selectUser);
  if (dbUser === undefined) {
    lengthOfPassword = password.length;
    if (lengthOfPassword < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createNewUser = `INSERT INTO user(username,password,name,gender)
            VALUES(
                '${username}',
                '${hashedPassword}',
                '${name}','${gender}'
            )`;
      const newUser = await db.run(createNewUser);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});
//login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUser = `SELECT * FROM user WHERE username='${username}'`;
  const dbUser = await db.get(selectUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isCorrect = await bcrypt.compare(password, dbUser.password);
    if (isCorrect === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "sai");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
const authenticateToken = (request, response, next) => {
  const authHead = request.headers["authorization"];
  let jwtToken;
  if (authHead !== undefined) {
    jwtToken = authHead.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "sai", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;

        next();
      }
    });
  }
};
// app.get("/", authenticateToken, async (request, response) => {
//   const { username } = request;
//   const gettingUserId = `select user_id from user where username='${username}'`;
//   const getAUser = await db.get(gettingUserId);
//   const getFollowing = `SELECT following_user_id from follower WHERE follower_user_id=${getAUser.user_id}`;
//   const tableFollowing = await db.all(getFollowing);
//   console.log(tableFollowing);
// });

//all tweet

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const findingUserId = `SELECT user_id FROM user where username='${username}'`;
  const getUserId = await db.get(findingUserId);
  //   console.log(getUserId);

  const getFollowingUserId = `SELECT following_user_id FROM follower
    WHERE follower_user_id=${getUserId.user_id}`;
  const res = await db.all(getFollowingUserId);
  const followed_ids = res.map((e) => e.following_user_id);
  console.log(followed_ids);
});

//following table

app.get("/user/following/", authenticateToken, async (request, response) => {
  const getFollowingName = `SELECT user.name FROM user INNER JOIN follower
    ON user.user_id= follower.following_user_id`;
  const res = await db.all(getFollowingName);
  response.send(res);
});

//follower table
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getFollowingName = `SELECT user.name FROM user INNER JOIN follower
    ON user.user_id= follower.follower_user_id`;
  const res = await db.all(getFollowingName);
  response.send(res);
});

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  let { username } = request;
  const gettingFollowers = `select user_id from tweet where tweet_id=${tweetId}`;
  const dbRes = await db.get(gettingFollowers);
  const gettingUserId = `select user_id from user where username='${username}'`;
  const getAUser = await db.get(gettingUserId);
  if (dbRes === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const gettingAllActivity = `SELECT tweet.tweet,COUNT(DISTINCT like.user_id) as likes,
    COUNT(DISTINCT reply.user_id) as replies,tweet.date_time as dateTime
    from (tweet INNER JOIN like ON tweet.user_id= like.user_id) as t
   inner join reply ON t.user_id= reply.user_id WHERE tweet.tweet_id=${tweetId}`;
    const requiredResult = await db.get(gettingAllActivity);
    response.send(requiredResult);
  }
});

//tweet likes

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const gettingFollowers = `select user_id from tweet where tweet_id=${tweetId}`;
    const dbRes = await db.get(gettingFollowers);
    const getFollowingName = `SELECT user.name FROM user INNER JOIN follower
    ON user.user_id= follower.follower_user_id
    where user.user_id=${dbRes.user_id}`;
    const res = await db.get(getFollowingName);
    if (res === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const allLikedList = `SELECT user.username from
    like INNER JOIN user ON like.user_id= user.user_id
    WHERE like.tweet_id=${tweetId}`;
      const likes = await db.all(allLikedList);
      response.send({ likes: likes });
    }
  }
);

//user replies

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const gettingFollowers = `select user_id from tweet where tweet_id=${tweetId}`;
    const dbRes = await db.get(gettingFollowers);
    const getFollowingName = `SELECT user.name FROM user INNER JOIN follower
    ON user.user_id= follower.follower_user_id
    where user.user_id=${dbRes.user_id}`;
    const res = await db.get(getFollowingName);
    if (res === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const allReplies = `select user.name,reply.reply as replies
      FROM user INNER JOIN reply ON user.user_id= reply.user_id
      WHERE reply.tweet_id=${tweetId}`;
      const replies = await db.all(allReplies);
      response.send({ replies: replies });
    }
  }
);

//tweets of user
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const allTweets = `SELECT tweet.tweet, SUM(DISTINCT like.user_id) as likes,
        SUM(DISTINCT reply.user_id) as replies,tweet.date_time as dateTime
        FROM (tweet INNER JOIN like ON tweet.tweet_id= like.tweet_id) as t
        inner join reply on t.tweet_id= reply.tweet_id
        GROUP BY tweet.tweet_id`;
  const res = await db.all(allTweets);
  response.send(res);
});

//posting a tweet

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const timeNow = new Date();
  const postTweet = `INSERT INTO tweet(tweet,date_time)
    VALUES(
        '${tweet}',
        '${timeNow}'
    )`;
  const addATweet = await db.run(postTweet);
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const findingUserId = `SELECT user_id FROM user where username='${username}'`;
    const getUserId = await db.get(findingUserId);
    const findingTweetUserId = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId}`;
    const gettingTweetId = await db.get(findingTweetUserId);
    if (getUserId.user_id !== gettingTweetId.user_id) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweet = `DELETE FROM tweet
        WHERE tweet_id=${tweetId}`;
      const res = await db.run(deleteTweet);
      response.send("Tweet Removed");
    }
  }
);
module.exports = app;
