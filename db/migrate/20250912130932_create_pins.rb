class CreatePins < ActiveRecord::Migration[7.2]
  def change
    create_table :pins do |t|
      t.string :name
      t.string :address
      t.string :place_id
      t.float :latitude
      t.float :longitude
      t.integer :category
      t.integer :visibility
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end
  end
end
