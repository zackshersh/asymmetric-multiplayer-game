# asymmetric-multiplayer-game 

# Copilot Prompt

Create an asymmetric multiplayer spaceship game. The game is 2v1 or 3v1. The team with 2 or 3 players act as the crew of a spaceship, manning different posts that all need to act together to successfully use the spaceship to complete their goals. The other player acts as the commander of their own army of other ships, playing in the style of a Real Time Strategy game.

The spaceship's crew's goal is to destroy the enemy commander's base. They will mine resources to upgrade their ship to increase its power and abilities in order to better attack the commander's base.

The commander's goal is to destroy the enemy ship. They must mine resources to build up their defenses and to create ships of their own that they can control in the style of a real time strategy game to defend from the crewed ship and to go on the offensive and attack.

## The Spaceship Crew

The roles in the Spaceship are as follows:

1. The Pilot - The pilot steers the ship, able to steer by rotating the ship and applying thrust in the direction of flight.

2. Gunner/Reconaissance - This role controls turrets on the ship which can rotate 360 degrees, and can control various information gathering equipment on the ship. The gunner also controls the ship's mining laser.

3. Engineer - This role is responsible for controlling and repairing the inner workings of the ship. The ship has an energy budget which can be put towards thrusters, weapons and shields. The engineer can adjust how the energy budget is split up amongst those three, with more power going to them translating to more powerful thrusters, shields or weapons. Additionally, the engineer is responsible for fixing things when they break. The engineer's repair screen shows various components of the ship which correspond with various capabilities of the ship. Taking damage from enemies or collisions with objects can cause these components to break, making those capabilities of the ship not function until the engineer repairs them. The engineer has to do certain puzzles and things in order to repair them. Those puzzles and things will be figured out later, for now, if a component breaks, make it so that the engineer just needs to click the component to repair it. 


### Spaceship Notes

- The ship's shields are a regenerating shield which prevents any damage to the ship while they are active. Upon taking damage, their strength decreases and once it reaches 0 the ship and its components can be damaged by enemy attacks. They shields slowly replenish over time

### Spaceship mining and upgrades

- Scattered around the map are special asteroids made up of ore
- The crew of the spaceship must find these asteroids and the gunner must use the mining laser to mine the materials. When the mining laser is used on an ore-containing asteroid, it causes chunks of material to drift off which the ship automatically collects upon colliding with them.
- The ship engineer is responsible for using these resources to upgrade the ship. There are upgrade progression tracks for different parts of the ship's capabilities. These upgrades will either simply improve the ship's stats in a certain category or will grant a new ability. The upgrade tracks are as such:
    1. Weapons
        1. First Upgrade: Increase main gun attack power
        2. Second Upgrade: Basic missiles that the gunner can switch to which are powerful and create an explosion around their impact point. These missiles automatically regenerate after a cooldown period.
        3. Third Upgrade: Mounted guns are added to the front of the ship, giving the pilot the ability to fire guns forward.
        4. Fourth Upgrade: Main gun attack power increased.
        The tree diverges here into two paths
        5. Path A - Missiles
            1. Heat Seeking Missiles
            2. Missiles do more damage and have a larger explosion radius.
            3. Gunner gets access to Bunker Buster Missiles which are a second type of missile they can switch to which does extreme damage to the enemy commander's base and is used in end game.
    2. Thrusters
        1. First Upgrade: Increased thruster power (increasing thruster power improve both thrust and rotation speed)
        2. Second Upgrade: Strafing thrusters are added which allow the pilot to manuever the ship horizontally with Q and E
        3. Third Upgrade: Increased thruster power
        4. Fourth Upgrade: Increased thruster power
    3. Shields 
        1. First Upgrade: Increased shield strength
        2. Second Upgrade: Increased shield recovery speed
        3. Third Upgrade: Collision shield upgrade which makes it that collisions with enemies or structures while the ship's shield is active will do no damage to the shield and will do some damage to the enemy or structure. This damage is proportional to the ship's velocity relative to the enemy unit or structure.
        4. Fourth Upgrade: Increased shield strength
        5. Fifth Upgrade: Shield power sponge mode, which is a mode that can be activated by the engineer which makes it so that for a period of 5 seconds, every enemy projectile that hits the ship will increase the ship's power budget. Once the power sponge mode ends, the ship's power budget will return to normal over the course of a 5 seconds.
    4. Reconaissance
        1. First Upgrade: Active Scan, which fires a radial pulse away from the ship which reveals the location of ore and enemies in a certain radius around the ship. If the enemy commander has any units or structures that are hit by that pulse, the general location of its source while be revealed.
        2. Second Upgrade: Increased active scan range.
        3. Third Upgrade: Scout drone. Using a certain amount of resources, the engineer can produce a scout drone. Once a scout drone is ready, the gunner can control it, which moves their view to that of the drone which they can fly around the map searching for enemy units and structures. The scout drone has a lifespan of 30 seconds.


## RTS Style Commander

The player serving as the RTS style commander can build structures, build units and control those units. 

They begin with a basic base which has the ability to construct basic attack units, scout units and mining units. They begin with a small amount of ore with which they can construct units. To get more ore they need to construct mining units which they can either send in a specific direction or just send to automatically search for and mine ore. 

The commander has a fog of war style effect where they can't see what the map looks like until they have had a unit visit there. 

### Structures

The commander can construct new structures which will take a certain amount of ore and a certain amount of time to construct. These structures include:
1. Unit Factories - The commander can construct units in this factory by selecting the units he wants to construct which will then go in a construction queue. A single factory can construct one unit at a time. Each unit type has an amount of time they take to construct. The commander can also set the point the units should go to after being constructed.
2. Research Stations - Constructing a research station will increase the commander's technology level by 1. Research stations can be upgraded to provide higher technology levels and/or the commander can build multiple.
3. Turrets - Turrets can be placed around a commander's structures. When the enemy ship gets within the turret's range, it will automatically fire at it. The turret is able to lead its shots based on the enemy ship's current trajectory and velocity.
    - Turret Types:
        - Basic Turret (Technology Level 0): Medium armored, low damage automatic turret
        - Advanced Turret (Technology Level 1): Higher armor, higher damage
        - Long Range Turret (Technology Level 2): Able to attack ships from a very long range. Fires an extremely fast ray attack.


### Units

Every unit can be instructed to navigate to a point by the commander right clicking a point in space while having a unit or units selected. They utilize navigation algorithms to navigate around asteroids and structures. Units can be made to navigate to several points in a row by the commander holding shift while right clicking points in space in the order they want the units to travel to.

Different units can also have target specific actions, such as mining units being directed to finding their way to an ore containing asteroid, or attacking units being able to lock on to a single target and follow it until being destroyed or told to stop.

Attack unit behavior is as such: when ordered to attack a target, they will form a circle around the target, shooting it from multiple angles. The radius of the circle they form will be dependent on their unit type.

Each type of unit has a discovery radius, which is the radius around the unit within which the fog of war is permanently cleared and any enemy ships within the radius at that moment will be revealed.

1. Technology Level 0
    1. Basic Mining Unit - Basic mining unit, slow speed and slow rate of ore extraction. Able to autonomously search for ore containing asteroids. - 50 ore
    2. Basic Scouting Unit - Small, fast, light unit with a large discovery radius. - 25 ore
    3. Basic Attack Unit - Small attack units with guns that do a small amount of damage. They have medium speed and a small amount of armoring. - 60 ore
2. Technology Level 1
    1. Advanced Attack Unit - Like the basic attack unit except larger, with more health and doing more damage. - 100 ore
    2. Suicide Unit - A medium sized, fairly fast unit that explodes when killed. They try to crash into the enemy ship and explode on impact, doing a fair amount of damage. Friendly units within range of the explosion will receive damage as well. - 50 ore
    3. Basic Healer Unit - A medium sized, medium armoured unit that heals other units within range of it. - 150 ore
3. Technology Level 2
    1. Heavy Attack Unit - Heavily armored, large units with high rate of fire, fairly high damage weapons. They move slightly slowed than the normal attack unit. - 400 ore
    2. Long Range Attack Unit - Lightly armoured units that can attack the enemy from further away. They have a low rate of fire but their shots travel very quickly and do high damage. - 200 ore
    3. Advanced Mining Unit - Faster speed and higher mining rate than basic mining units. They are able to get more ore from a similar sized asteroid than a basic mining unit. - 150 ore
4. Technology Level 3
    1. Agile Attack Unit - Small, medium armored, very fast units with medium damage. They can strafe from side to side, avoiding enemy attacks, and move in unpredictable patterns. - 350 ore
    2. Immobilizer Units - Slow moving, medium armored units. They have a very slow rate of fire. They shoot a ray that does no damage but disables the enemy's thrusters for several seconds - 700 ore
    3. Battleship - A very large, heavily armored ship with multiple turrets that do medium damage.

### Technology Levels
Which units and structures the commander can construct is decided by their technology level, higher levels allowing them to construct more advanced and powerful units and structures.




## Implementation and General Notes
The game should use a React based frontend, with Vite as the build tool, and a socketio based backend. The physics should be controlled with the Matterjs physics library. It should all be written in Typescript.

The style of the game and the UI elements should be technical and sci-fi seeming, using text and outlines on a dark background. Use a monospace typeface.
