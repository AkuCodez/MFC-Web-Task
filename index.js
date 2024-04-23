import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import env from "dotenv";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
    })
);

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
    ssl: true
})

db.connect();


function formatDate(dateTimeStr) {
    const date = new Date(dateTimeStr);
    const options = { month: 'short', day: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

app.get("/", async (req, res) => {
    if (req.isAuthenticated()) {
        console.log('User authenticated');
      } else {
        console.log('User not')
      }
    const result = await db.query("SELECT * FROM bdata ORDER BY id DESC LIMIT 2");
    //const formattedDate = await db.query ("SELECT id, TO_CHAR(created_at, 'Mon DD YYYY') AS formatted_date FROM bdata;")
    let latestBlog = result.rows[0];
    let latestBlog2 = result.rows[1];
    const formattedDate = formatDate(latestBlog.created_at);
    const formattedDate2 =formatDate(latestBlog2.created_at);
    res.render("index.ejs", {
        latestBlog: latestBlog,
        latestBlog2: latestBlog2,
        formattedDate: formattedDate,
        formattedDate2:formattedDate2
    });
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});


app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.post("/register", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;

    try {
        const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    
        if (checkResult.rows.length > 0) {
          res.send("Email already exists. Try logging in.");
        } else {
          bcrypt.hash(password, saltRounds, async (err, hash) => {
            if (err) {
              console.error("Error hashing password:", err);
            } else {
                console.log("Hashed Password:", hash);
                const result = await db.query(
                    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *",
                    [email, hash]);
                const user = result.rows[0];
                req.login(user, (err) => {
                    console.log("success");
                    res.redirect("/home");
                }); 
            } 
        });
      } 
    }  catch (err) {
        console.log(err);
        }
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/home",
    failureRedirect: "/login",
  })
);

    // const email = req.body.username;
    // const loginPassword = req.body.password;
  
    // try {
    //   const result = await db.query("SELECT * FROM users WHERE email = $1", [
    //     email,
    //   ]);
    //   if (result.rows.length > 0) {
    //     const user = result.rows[0];
    //     const storedHashedPassword = user.password_hash;
    //     //verifying the password
    //     bcrypt.compare(loginPassword, storedHashedPassword, (err, result) => {
    //       if (err) {
    //         console.error("Error comparing passwords:", err);
    //       } else {
    //         if (result) {
    //           res.render("secrets.ejs");
    //         } else {
    //           res.send("Incorrect Password");
    //         }
    //       }
    //     });
    //   } else {
    //     res.send("User not found");
    //   }
    // } catch (err) {
    //   console.log(err);
    // }
  //});

app.get("/create", async (req,res) => {
    if (req.isAuthenticated()) {
        res.render("create.ejs");
      } else {
        res.redirect("/login");
      }  
});

app.post ("/create", async (req,res) => {
    if (!req.isAuthenticated()) {
        // Redirect to login if user is not authenticated
        return res.redirect("/login");
    }
    const userId = req.user.id;
    const title = req.body.title;
    const content = req.body.content;
    const author = req.body.author;

    try {
        const result = await db.query("INSERT INTO bdata (title, content, author, user_id) VALUES ($1,$2,$3,$4)", [title, content, author, userId]);
        console.log(result);
        if (result.rowCount > 0) {
            return res.redirect("/home"); // Redirect to home page or dashboard
        } else {
            // Error handling if blog post creation fails
            res.status(500).send("Failed to create blog post");
        }
    } catch (err) {
        console.error("Error creating blog post:", err);
        res.status(500).send("Internal server error");
    }
});

app.get("/home", async (req,res) => {
    console.log(req.user);
    if (req.isAuthenticated()) {
        const result = await db.query("SELECT * FROM bdata ORDER BY id DESC LIMIT 2");
      //const formattedDate = await db.query ("SELECT id, TO_CHAR(created_at, 'Mon DD YYYY') AS formatted_date FROM bdata;")
      let latestBlog = result.rows[0];
      let latestBlog2 = result.rows[1];
      const formattedDate = formatDate(latestBlog.created_at);
      const formattedDate2 =formatDate(latestBlog2.created_at);
      res.render("ahome.ejs", {
          latestBlog: latestBlog,
          latestBlog2: latestBlog2,
          formattedDate: formattedDate,
          formattedDate2:formattedDate2
      });
      } else {
        res.redirect("/login");
      }      
});

app.get("/blogs4normies", async (req, res) => {
    try {
        // Retrieve all blogs from the bdata table
        const query = "SELECT * FROM bdata ORDER BY id DESC";
        const result = await db.query(query);

        // Render the blogs page with the retrieved blog data
        res.render("blogs4normies.ejs", { blogs: result.rows, formatDate: formatDate});
    } catch (err) {
        console.error("Error fetching blogs:", err);
        res.status(500).send("Internal server error");
    }
})

app.get("/blogs", async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.redirect("/blogs4normies");
        // Redirect to login if user is not authenticated
    }
    try {
        // Retrieve all blogs from the bdata table
        const query = "SELECT * FROM bdata ORDER BY id DESC";
        const result = await db.query(query);

        // Render the blogs page with the retrieved blog data
        res.render("blogs.ejs", { blogs: result.rows, formatDate: formatDate});
    } catch (err) {
        console.error("Error fetching blogs:", err);
        res.status(500).send("Internal server error");
    }
});

// function formatContent(content) {
//     return content.replace(/\n/g, '<br>');
// }
// app.locals.formatContent = formatContent;

app.get("/yourblogs", async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query("SELECT * FROM BDATA WHERE user_id = $1", [userId]);
        const blogIds = result.rows.map(blog => blog.id);
        console.log(blogIds);
        //const blogId = result.rows.id;
        //console.log(blogId);
        res.render("yourblogs.ejs", {
            blogs: result.rows, formatDate: formatDate, blogIds: blogIds
        });
    } catch (err) {
        console.error("Error fetching blogs:", err);
        res.status(500).send("Internal server error");
    }
})

app.get("/edit/:id", async (req,res) => {
    try {
        if (!req.isAuthenticated()) {
            return res.redirect("/login");
        }
        
        const postId = req.params.id;
        const query = 'SELECT id, title, content FROM bdata WHERE id = $1';
        const { rows } = await db.query(query, [postId]);

        if (rows.length === 0) {
            return res.status(404).send("Blog post not found");
        }

        const { id, title, content } = rows[0];

        res.render("edit.ejs", {
            postId: postId, id, title, content
        });
    } catch (error) {
        console.error("Error fetching blog post:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post ("/edit/:id", async (req, res) => {
    try {
        const postId = req.params.id;
        const { title, content } = req.body;

        // Perform database update operation (e.g., UPDATE query)
        const updateQuery = 'UPDATE BDATA SET title = $1, content = $2 WHERE id = $3';
        await db.query(updateQuery, [title, content, postId]);

        // Redirect user back to /yourblogs after successful update
        res.redirect("/yourblogs");
    } catch (error) {
        console.error("Error updating blog post:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/delete/:id", async (req, res) => {
    try {
        const postId = req.params.id;

        // Perform database deletion operation (e.g., DELETE query)
        const deleteQuery = 'DELETE FROM BDATA WHERE id = $1';
        await db.query(deleteQuery, [postId]);

        // Redirect user back to /yourblogs after successful deletion
        res.redirect("/yourblogs");
    } catch (error) {
        console.error("Error deleting blog post:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.get('/logout', function(req, res, next) {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });

passport.use(
    new Strategy(async function verify(username, password, cb) {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
          username,
        ]);
        if (result.rows.length > 0) {
          const user = result.rows[0];
          const storedHashedPassword = user.password_hash;
          bcrypt.compare(password, storedHashedPassword, (err, valid) => {
            if (err) {
              //Error with password check
              console.error("Error comparing passwords:", err);
              return cb(err);
            } else {
              if (valid) {
                //Passed password check
                return cb(null, user);
              } else {
                //Did not pass password check
                return cb(null, false);
              }
            }
          });
        } else {
          return cb("User not found");
        }
      } catch (err) {
        console.log(err);
      }
    })
  );

  passport.serializeUser((user, cb) => {
    cb(null, user);
  });
  passport.deserializeUser((user, cb) => {
    cb(null, user);
  });


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

