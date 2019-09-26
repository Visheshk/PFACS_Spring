// import axios from "axios"
import * as React from 'react';
// import {GoogleLogin, GoogleLoginResponse} from "react-google-login"
import {GoogleLoginResponse} from "react-google-login";
// import {Route, Router} from "react-router"
// import {Button, ButtonGroup, Card, CardContent,CardHeader, Grid, GridColumn, GridRow, Header } from "semantic-ui-react"
import {Card, CardContent,CardHeader, Grid } from "semantic-ui-react";
import styled from "styled-components";
// import {HeaderText, TitleText} from "../AppStyle";
import {Student, StudentStatus} from '../data_structure/Student';
import {ISession, UserContext} from "../Context"
// import {Layout} from "../Layout"
import StudentGraphUsage from "./StudentGraphUsage";
import {StudentOverview} from "./StudentOverview";
// import * as openSocket from 'socket.io-client'; 
import openSocket from 'socket.io-client'; 
import {StudentCurrentDetails} from "./StudentCurrentDetails";
import {idNamesPair} from "./../studentsIDsName";

// Now I'm totally lost about how I should approach this problem
// the problem that I need to reflect the data in the server onto the frontend. 
const socket = openSocket("http://localhost:3001/studentstatus")

/* CSS for components */
const GridHeaderStyle = {
  paddingLeft: "50px",
  paddingTop: "32px",
  fontFamily: "Roboto",
  fontStyle: "normal",
  fontWeight: "normal",
  height: "60px",
  color: "#000000",
  borderWidth:"0px"
}

const TotalStudentLabel = styled.div`
  font-family: Roboto;
  font-style: normal;
  font-weight: normal;
  font-size: 18px;
  line-height: normal;

  color: #C0C0C0;

  display: inline;
  // padding-left:60%;
  right: 50px;
  position: absolute
`

const Rect = styled.div <{status: StudentStatus}> `
    &:first-of-type{
      margin-left:4px;
    }

    width:15px;
    height:15px;
    background-color: ${props=>generateColorBasedOnStatus(props.status)};
    margin-right: 6px;
    margin-left: 30px;
    // display: block;
    display: inline-block;   
`

function generateColorBasedOnStatus(status: StudentStatus){
    switch (status) {
      case StudentStatus.InProgress:
        return "#DAF8FF"
        break;

      case StudentStatus.Idle:
        return "#EFEFEF"
        break;

      case StudentStatus.Absent:
        return "#EFEFEF"   

      case StudentStatus.Stuck: 
        return "#E2DAFF"

      default:
        return "#000000"
    }
} 

/* Interface for the state */
interface ILiveDashboardState {
  studentChosen?: string ,
  response?: GoogleLoginResponse,
  accessToken? : string
  currentView: string,  // "dashboard" or "report"
  sessionData: ISession,
  studentData: Student[],
  doesShowSpecificDetail: boolean,
  specificStudentData?: Student,
  loading: boolean,
  classOverviewData: Object,
  lockSpecificDetail: boolean
}


/* Main component */
class LiveDashboard extends React.Component  <any, ILiveDashboardState>{

    public constructor(props: any) {
        super(props)
        this.state = {studentChosen: undefined, response: undefined, accessToken: undefined, currentView: "dashboard", sessionData: this.props.sessionData, 
        studentData: this.props.studentData, doesShowSpecificDetail: false, specificStudentData: undefined, loading: false, classOverviewData: {}, lockSpecificDetail: false}


        socket.on("receive initial data", message =>{
          console.log("receive initial data")
          // The initial data will decide the initial status 
          // get rid of the loading problem 
          this.setState({loading: false})
          const updatedDocuments = message  
          let updatedStudentDataArray = this.state.studentData
          const newUpdatedStudentData: Student[] = []
          for (const document of updatedDocuments) {  
              const searchResults = this.state.studentData.filter( s => s.id === document.playerUniqueID)
              
              if (searchResults.length > 0) {
                const studentNeedToBeUpdated = searchResults[0];
                ///////******* TODO: can propList be a shared variable across this and live status update and makeTableData ? *********///////
                let propList = ["currentTurn", "currentScreen", "currentCash", "currentFans", "lastActTime", "madeInsight", "successfulInsight", "twoSongsReleased", "upgradedStorage", "lineUse", "heatmapUse", "barChartUse", "storageBuys", "insightCount", "successfulInsightCount", "releasedSongCount"];
                for (let p in propList) {
                  // console.log(p);
                  studentNeedToBeUpdated[propList[p]] = document[propList[p]];
                }
                
                studentNeedToBeUpdated.status = this.calculateWhetherOnline(document.lastActTime);
                studentNeedToBeUpdated.startTimer(this.statusSetFunction);
                // decide on the status based on the last active time 
                newUpdatedStudentData.push(studentNeedToBeUpdated)
                updatedStudentDataArray = updatedStudentDataArray.filter(s => s.id !== document.playerUniqueID)
              }
          }

          updatedStudentDataArray = updatedStudentDataArray.concat(newUpdatedStudentData);

          console.log(this.props.studentData);
          this.setState({studentData: updatedStudentDataArray});
          this.setState({classOverviewData: this.makeTableData(updatedStudentDataArray)});
        })

        socket.on("live status update", (message: any) => {
          // convert data from the backend. 
          console.log("Data update");
          const newStudentData: Student[] = [];
          this.setState({loading: false});
          const updatedDocuments = message;
          console.log(updatedDocuments.length);
          let updatedStudentDataArray = this.state.studentData;
          const newUpdatedStudentData: Student[] = [];
          for (const document of updatedDocuments) {
              const searchResults = this.state.studentData.filter( s => s.id === document.playerUniqueID);
              if (searchResults.length > 0) {
                const studentNeedToBeUpdated = searchResults[0];
                let propList = ["currentTurn", "currentScreen", "currentCash", "currentFans", "lastActTime", "madeInsight", "successfulInsight", "twoSongsReleased", "upgradedStorage", "lineUse", "heatmapUse", "barChartUse", "storageBuys", "insightCount", "successfulInsightCount", "releasedSongCount"];
                for (let p in propList) {
                  // console.log(p);
                  studentNeedToBeUpdated[propList[p]] = document[propList[p]];
                }
                studentNeedToBeUpdated.statusReset(this.statusSetFunction);
                newUpdatedStudentData.push(studentNeedToBeUpdated);
                updatedStudentDataArray = updatedStudentDataArray.filter(s => s.id !== document.playerUniqueID);
              }
          }
          updatedStudentDataArray = updatedStudentDataArray.concat(newUpdatedStudentData);
          this.setState({studentData: updatedStudentDataArray});
          this.setState({classOverviewData: this.makeTableData(updatedStudentDataArray)});
        });
      }

      public makeTableData(sArray: Student[]) : Object{

        let tableData = {
          // {'header': "Collection and Storage"},
          "C&S Views": {often: 1, rarely: 0, notUse: 0},
          "Variable modifications": {often: 2, rarely: 0, notUse: 0},
          "Storage Increases": {often: 3, rarely: 0, notUse: 0},

          // {'header': "Data viz/graphing"},
          "bar graph": {often: 4, rarely: 0, notUse: 0},
          "line graph": {often: 5, rarely: 0, notUse: 0},
          "heatmap": {often: 6, rarely: 0, notUse: 0},

          // {'header': "Insight/inferences"},
          "Made insights": {often: 7, rarely: 0, notUse: 0},
          "Successful insights": {often: 8, rarely: 0, notUse: 0},
          "Good predictions": {often: 9, rarely: 0, notUse: 0},
        };

        for (let s in sArray) {
          if (sArray[s]["storageBuys"] > 2) {
            tableData["Storage Increases"]["often"]++;
            //sArray[s][""]
            //*** TODO: Make table counts come from student attributes
            //*** add student property - bar graph use - frequent, often, rare; and so on
          } 
          else if (sArray[s]["storageBuys"] > 0) {
            tableData["Storage Increases"]["rarely"]++;
          }
          else if (sArray[s]["storageBuys"] == 0) {
            tableData["Storage Increases"]["notUse"]++;
          }
        }
        return tableData
      }

      public statusSetFunction = (id: String, status: any) => {
        this.setState( ( prevState )=>{
          const otherStudentData = prevState.studentData.filter( s => s.id !== id)
          const searchResults = prevState.studentData.filter( s => s.id === id)
          if (searchResults.length > 0) {
            const studentNeedToBeUpdated = searchResults[0]
            studentNeedToBeUpdated.status = status
            const updatedResults = otherStudentData.concat(studentNeedToBeUpdated)
            return {...prevState, studentData: updatedResults}
          }
          return {...prevState}
        }) 
      }

      public wrapData = (studentIds: any) => {
        // just for dummy data 
        return Object.keys(studentIds).map((s: any) => {
          return new Student(studentIds[s] , StudentStatus.Idle, s, 10000, 10, 100000, "Make songs");
        });
      }
      
      public convertIdsToIdNamePair (ids: string[]){
        const idNamePairRet = {}
        ids.forEach((id) =>{
          idNamePairRet[id] = idNamesPair[id]
        })
        return idNamePairRet
      }

      public componentDidMount(){

        const students = ["5d8e8868a3bb1d4f2dcec66cac311f13", "eb8452b1765435e9f7ca856809c7fc31", "d88a1b66dece974a1c2576c752c3a187", "604527392b8c515ea87122933a57cb51", "aee6c2569ea2cf8b88d79a7c36a90015"]
        // const idNames = {"aee6c2569ea2cf8b88d79a7c36a90015": "JJ", "403870ae4811bcb15dcdfe7f0c2ad3f8": "Vishesh", "a47746fa74fe8f3823d48dfdcbc13618": "Nathan", "e311f1a829e27d2f8a4aef242ad0f71c": "Matthew", "fe185d1d04a7d905953ed7455f0561ca": "Reina", "3242fe1dc946799d204984d330975432": "Daisy"};
        // const idNames = this.convertIdsToIdNamePair(this.props.studentData)
        // const studentData = this.wrapData(idNames);
        
        this.setState({loading: true, studentData: this.props.studentData})
        
        // set dummy data for right now, if the second time change, it shouldn't be dummy data, just minor performance issue 
        // this.setState({studentData}) 
        
        console.log("live dashboard");
        // console.log(studentData);
        console.log(this.props.studentData)
        const studentIds = this.props.studentData.map(s => s.id)
        socket.emit('listen to live data', { "students": studentIds} );

        window.onbeforeunload = () =>{
          socket.emit('stop listening student status');
        }
      }

      public componentWillUnmount(){
        // close connection
        // axios.post("/mongodata/endlivedata").then(res => {
        //   console.log(res.data)
        // });
        socket.emit('stop listening student status')
        this.props.studentData.forEach(s => {
          s.clearTimeout()   
        });
      }

      public onMouseOverASpecificStudentEvent = (studentData: Student) =>{
        // console.log(studentData.name)
          if (this.state.lockSpecificDetail){
            return
          }

          this.setState({doesShowSpecificDetail: true, specificStudentData: studentData})
      }

      public onMouseOutASpecificStudentEvent = () =>{
          if (this.state.lockSpecificDetail){
            return
          }
          this.setState({doesShowSpecificDetail: false, specificStudentData: undefined})
      }

      public onClickOnASpecificStudentEvent = (studentData: Student) => {
        this.setState({doesShowSpecificDetail: true, specificStudentData: studentData, lockSpecificDetail: true})
      }

      public onCloseOnASpecificStudentEvent = () =>{
        this.setState({lockSpecificDetail: false, doesShowSpecificDetail: false, specificStudentData: undefined})
      }
      

    public render(){
        return (
            <UserContext.Consumer>
            { value => 
            <React.Fragment>
                {this.state.loading ? <div> loading </div> : 

                <Grid style={{position: "relative"}}>
                <Grid.Row>
                <Grid.Column width="1"/>
                  <Grid.Column width="7">
                      <Card style={{width:"100%",  height:"70vh", borderWidth: "0px"}} >

                        <CardHeader textAlign="left" style={GridHeaderStyle} >
                            <div style={{display: "inline", fontSize:"18px", fontWeight: "bold"}}> Students </div>
                            <TotalStudentLabel> 24 Total students</TotalStudentLabel>
                            {/* Need some non-hard code later */}
                        </CardHeader>

                        <CardContent style={{padding: "20px 50px 0px 50px", borderWidth:"0px"}}>
                          {/* the goal is to connect the left with right */}
                          {/* Pass the function to control the data in the on hover */}
                          <StudentOverview showDetailed={this.showDetailed} studentData={this.state.studentData}
                            onMouseOverASpecificStudentEvent= {this.onMouseOverASpecificStudentEvent}
                            onMouseOutASpecificStudentEvent={this.onMouseOutASpecificStudentEvent}
                            onClickOnASpecificStudentEvent={this.onClickOnASpecificStudentEvent}
                          />
                        </CardContent>

                        <div style={{fontSize: "16px", paddingLeft:"50px" , textAlign: "left", position:"absolute", bottom:"40px"}}>
                            <Rect status={StudentStatus.InProgress}/>
                            Engaged
                        
                            <Rect status={StudentStatus.Stuck}/>
                            Idle for 30 seconds
                            
                            <Rect status={StudentStatus.Absent}/>
                            Idle for 1 minute
                        </div>

                      </Card>
                  </Grid.Column>

                  <Grid.Column width="7" style={{display:"flex", justifyContent: "center", color:"#00000"}}>
                      {/* <StudentGraphUsage/> */}
                      {this.state.doesShowSpecificDetail? <StudentCurrentDetails student={this.state.specificStudentData} onCloseOnASpecificStudentEvent={this.onCloseOnASpecificStudentEvent} /> : <StudentGraphUsage tableData={this.state.classOverviewData}/>}

                  </Grid.Column>
                </Grid.Row>      
                </Grid>
                }
            </React.Fragment>
             
            }
            </UserContext.Consumer>

        )
    }

    public componentDidUpdate(prevProps: any) {
        if (prevProps.studentData !== this.props.studentData ){
          this.setState( {studentData: this.props.studentData} )
        }
    }



    private showDetailed = (studentId: string) => {
        return this.setState({studentChosen: studentId}) ;
      }

      // add private functions for clicking the dashboard button
      // change the state to dashboard
    private dashboardClick = () =>{
      this.setState({currentView: "dashboard"})
    }

    private reportClick = () =>{
      this.setState({currentView: "report"})
    }

    private calculateWhetherOnline = (lastActiveTime): StudentStatus => {
      let currentDate = new Date()
      let timeStampInSecond = Math.floor(currentDate.getTime()/1000)
      let timeDifference = timeStampInSecond - lastActiveTime
      if (timeDifference < 30){
        return StudentStatus.InProgress
      } else if (timeDifference >= 30 && timeDifference < 120){
        return StudentStatus.Stuck
      } 
      return StudentStatus.Idle
    }
}

export default LiveDashboard
