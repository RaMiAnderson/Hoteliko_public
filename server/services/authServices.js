const { getConnection } = require('../database/databaseConnector');
const cryptedBcrypt = require('./cryptageBcrypt');
const ADMIN_MODEL = require('../models/admin');
const USER_MODEL = require('../models/user');

const loginService = async (user) => {
    try {
        const result = await checkUserInBD(user);
        return result;
    } catch (err) {
        console.log("ERROR login service : " + err);
    }
}

const checkUserInBD = async (user) => {
    try {
        const connection = getConnection();
        const [adminRows] = await connection.execute(
            `SELECT * FROM ${ADMIN_MODEL.name} WHERE username = ? LIMIT 1`,
            [user.username]
        );

        if (adminRows.length > 0) {
            const adminBase = adminRows[0];
            const resultCheck = await cryptedBcrypt.comparePasswordEncrypted(user.password, adminBase.password);
            if (resultCheck) {
                return {
                    username: adminBase.username,
                    fonction: adminBase.fonction,
                    status: 200,
                    message: "Connexion réussi"
                };
            }
            return { status: 403, message: "Mot de passe incorrect" };
        }

        const [userRows] = await connection.execute(
            `SELECT * FROM ${USER_MODEL.name} WHERE username = ? LIMIT 1`,
            [user.username]
        );

        if (userRows.length > 0) {
            const userBase = userRows[0];
            const resultCheck = await cryptedBcrypt.comparePasswordEncrypted(user.password, userBase.password);
            if (resultCheck) {
                return {
                    username: userBase.username,
                    fonction: userBase.fonction,
                    status: 200,
                    message: "Connexion réussi"
                };
            }
            return { status: 403, message: "Mot de passe Incorrect" };
        }

        return { status: 403, message: "Votre username est introuvable" };

    } catch (err) {
        console.log("ERROR login service : " + err);
        throw new Error("ErrorServer");
    }
};

const getUserInBD = async (user) => {
    try {
        const connection = getConnection();

        const [adminRows] = await connection.execute(
            `SELECT * FROM ${ADMIN_MODEL.name} WHERE username = ? LIMIT 1`,
            [user.username]
        );
        if (adminRows.length > 0) return adminRows[0];

        const [userRows] = await connection.execute(
            `SELECT * FROM ${USER_MODEL.name} WHERE username = ? LIMIT 1`,
            [user.username]
        );
        if (userRows.length > 0) return userRows[0];

        return { status: 404, message: "User not found" };

    } catch (err) {
        console.log("ERROR login service : " + err);
        throw new Error("ErrorServer");
    }
}

const verifyU_srvc = async (user) => {
    try {
        const dataUser = await getUserInBD(user);
        if (dataUser.password) dataUser.password = "";
        return dataUser;
    } catch (err) {
        console.log("ERROR Verify USR " + err);
    }
}

module.exports = {
    loginService,
    verifyU_srvc
};
