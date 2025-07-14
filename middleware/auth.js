import jwt from'jsonwebtoken'

function verifyJWT(req, res, next) {
  const token_data = req.headers.authorization;
  
  if (!token_data) {
    console.log('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = token_data.split(' ')[1]
  jwt.verify(token, process.env.secret, (err, decodedToken) => {
    if (err) {
      console.log('Failed to authenticate token')
      return res.status(403).json({ message: 'Failed to authenticate token' });
    }
    req.user = decodedToken;
    next();
  });
}


export default verifyJWT;