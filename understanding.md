## 1. What we want to replace:
    - When a shop owner sees stock is getting low, they call manually to restock their items.
    - Has to consiuouly check what is to be restocked and when.
    - Intuition based prediction number of sufficient stock to have for future. 
    - No particular insights about velocity of sales of particular items.
    - Manually checking the expiry of stocks items.
    - Experience based actionable insights.     

## 2. Trigger:
    - When stock level is below a certain thershold, or the time taken to restock is greater than the time taken to sell the items.
    - When new stock arrives and daily at the time of login, make preciton based on ML till when we have enough stock.
    - Daily checking the expiry of stocks at the time of login.
    - Monthly, reports for stock levels, sales velocity, and expiry dates.
    - User askes a query

## 3. Output:
    - Autonomous/approval based requests sent to other stores for sending goods. -> Agents
    - ML prediction on when to restock and how much to restock based on sales velocity and historical data. -> Traditional ML
    - Reports -> Data Analysis
    - Answers to queries with respect to database (RAG?) -> RAG (? means not sure)
    - Expiry alerts for items that are nearing their expiry date. -> Trigger

## We will have 2 features:
    - 1. Fully Autonomous: Just a notfication sent to user that any process is ocurring in the background or has been completed. User can still review the process and cancel it if they want to.
    - 2. Approval Based: User will have to approve the process before it is executed.

## 4. How can we design failure: (samvid or tb elaborate)
1. **Autonomous/approval based requests sent to other stores for sending goods. -> Agents**
    - Failure: 
    - Approach: 
2. **ML prediction on when to restock and how much to restock based on sales velocity and historical data. -> Traditional ML**
    - Failure: 
    - Approach: 
3. **Reports -> Data Analysis**
    - Failure: 
    - Approach: 
4. **Answers to queries with respect to database (RAG?) -> RAG**
    - Failure: 
    - Approach: 
5. **Expiry alerts for items that are nearing their expiry date. -> Trigger**
    - Failure: 
    - Approach: