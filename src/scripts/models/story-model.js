import * as api from '../data/api.js'
export default class StoryModel{
    constructor(){
    }
    async fetchStories(token){
        return api.getStories(token)
    }
    async createStory(formData, token){
        return api.postStory(formData, token)
    }
}