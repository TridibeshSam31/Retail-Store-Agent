"""
This pipeline is responsible for Predicting the Demand of the each item belonging to each store
1. data-collection.py: is responsible for collecting historical sales data from a DB to csv.
2. data-engineering.py: is reponsible for extracting temporal features out of this csv.
3. prediction.py: is responsible for predicting the demand of each item of each store for tommorow and calulate ROP and EOQ.
4. evaluation.py: add the end of the day it calculates the distance between predicited demand and actual demand and takes an average of them
   if avg is greater that a specific thershold, then model will be re trained from scratch based on latest 3 years of data.
5. model.py: for training the model from scratch.
"""