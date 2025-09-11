class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  with_options if: :profile_completed? do
    validates :username, presence: true, uniqueness: true
    validates :full_name, :company, :work_location, :department, presence: true
  end
end
