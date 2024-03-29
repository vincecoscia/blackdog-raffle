import React, { useState, useEffect } from 'react';
import Confetti from 'react-dom-confetti';

const RaffleSlotMachine = ({ employees, onRaffleCompleted }) => {
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [raffleInProgress, setRaffleInProgress] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  const confettiConfig = {  // Configuration for the confetti
    angle: 90,
    spread: 360,
    startVelocity: 30,
    elementCount: 400,
    dragFriction: 0.1,
    duration: 5000,
    stagger: 0.1,
    width: "10px",
    height: "10px",
    perspective: "500px",
    colors: ["#a864fd", "#29cdff", "#78ff44", "#ff718d", "#fdff6a"]
  };

  const startRaffle = () => {
    setRaffleInProgress(true);
  };

  useEffect(() => {
    if (raffleInProgress) {
      const totalEntries = employees.reduce((total, employee) => total + employee.entries, 0);
  
      const weightedRaffle = () => {
        let randomValue = Math.random() * totalEntries;
        for (const employee of employees) {
          randomValue -= employee.entries;
          if (randomValue < 0) {
            return employee;
          }
        }
        return null;
      };
  
      const animationDuration = 5000;
      const intervalDuration = 100;
  
      const raffleAnimation = setInterval(() => {
        setCurrentEmployee(weightedRaffle());
      }, intervalDuration);
  
      setTimeout(() => {
        clearInterval(raffleAnimation);
        const winner = weightedRaffle();
        setCurrentEmployee(winner);
        setRaffleInProgress(false);
        onRaffleCompleted(winner);
      }, animationDuration);
    }

    if (currentEmployee && !raffleInProgress) {
        setConfettiActive(true);
        setTimeout(() => setConfettiActive(false), 5000);  // Deactivate after 5 seconds
    }
  }, [raffleInProgress]);

  return (
    <>
      <div className="flex w-full lg:w-auto lg:flex-row flex-col-reverse justify-center lg:justify-start items-center p-6 bg-slate-800 rounded-xl shadow-md">
      
        <button
          onClick={startRaffle}
          disabled={raffleInProgress}
          className={`mt-4 lg:mt-0 w-full lg:w-auto px-6 py-2 h-full text-white font-semibold bg-blue-500 rounded shadow-md transition duration-200 ease-in-out hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            raffleInProgress ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Start Raffle
        </button>
        <div className='lg:w-96 w-full lg:pr-6'>
          <div className="flex items-center justify-center w-full h-16 p-1 bg-white rounded shadow-md lg:ml-6 relative">
          <div className="absolute -top-1">
            <Confetti active={ confettiActive } config={ confettiConfig } />
          </div>
          <span className="text-xl font-semibold text-blue-900">
            {currentEmployee
              ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
              : '---'}
          </span>
          
        </div>
        </div>

      </div>
    </>
  );
};

export default RaffleSlotMachine;
