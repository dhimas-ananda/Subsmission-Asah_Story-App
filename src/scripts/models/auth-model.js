import * as api from '../data/api.js'
export default class AuthModel{
    async login(credentials){
        return api.loginUser(credentials)
    }
    async register(payload){
        return api.registerUser(payload)
    }
}
