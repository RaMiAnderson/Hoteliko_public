import decode from "../utils/decodeToken"
import axios from "axios"

const API_URL = import.meta.env.VITE_API_URL;

const getDataUser = async (token) => {
    const username = decode(token).username;
    const res = await axios.post(`${API_URL}/api/auth/verifyUser`, {username});
    return res.data;
}

export default {
    getDataUser 
}
